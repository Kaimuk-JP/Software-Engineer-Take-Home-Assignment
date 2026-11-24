import { addDays, daysBetween } from '../src/common/date-only';
import { TestContext } from './test-context';

// ผู้ใช้ตาม seed.sql
const REQUESTER = 1; // somchai.t
const SUPERVISOR = 3; // wichai.k
const SUPERVISOR_2 = 4; // pensri.m
const MANAGER = 5; // anan.s

interface EquipmentItem {
  id: number;
  tagNo: string;
  criticality: 'A' | 'B' | 'C';
  nextDueDate: string;
  cycleOriginalDueDate: string | null;
  pendingRequestId: number | null;
  daysUntilDue: number;
}

interface RequestBody {
  id: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  previousDueDate: string;
  cycleOriginalDueDate: string;
  requestedDueDate: string;
  requiredApproverRole: 'supervisor' | 'department_manager';
  escalationReason: string | null;
  decidedById: number | null;
}

interface PendingBody extends RequestBody {
  canDecide: boolean;
  cannotDecideReason: string | null;
}

interface ErrorBody {
  message: string | string[];
}

describe('Deferral requests (integration, PostgreSQL)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await TestContext.start();
  });

  afterAll(async () => {
    await ctx?.stop();
  });

  beforeEach(async () => {
    await ctx.reset();
  });

  async function equipment(tagNo: string): Promise<EquipmentItem> {
    const res = await ctx
      .http()
      .get('/api/equipment')
      .set('X-User-Id', String(REQUESTER))
      .expect(200);
    const found = (res.body as EquipmentItem[]).find((e) => e.tagNo === tagNo);
    if (!found) throw new Error(`no equipment ${tagNo}`);
    return found;
  }

  function submit(
    userId: number,
    equipmentId: number,
    requestedDueDate: string,
    reason = 'รออะไหล่จากผู้ผลิต',
  ) {
    return ctx
      .http()
      .post('/api/deferral-requests')
      .set('X-User-Id', String(userId))
      .send({ equipmentId, requestedDueDate, reason });
  }

  function decide(
    action: 'approve' | 'reject',
    userId: number,
    requestId: number,
  ) {
    return ctx
      .http()
      .post(`/api/deferral-requests/${requestId}/${action}`)
      .set('X-User-Id', String(userId))
      .send({});
  }

  /** ยื่นแล้วให้ผู้อนุมัติที่ระบุอนุมัติ คืนค่าคำขอที่อนุมัติแล้ว */
  async function submitAndApprove(
    equipmentId: number,
    requestedDueDate: string,
    approverId: number,
  ): Promise<RequestBody> {
    const created = await submit(REQUESTER, equipmentId, requestedDueDate);
    expect(created.status).toBe(201);
    const approved = await decide(
      'approve',
      approverId,
      (created.body as RequestBody).id,
    );
    expect(approved.status).toBe(200);
    return approved.body as RequestBody;
  }

  describe('X-User-Id', () => {
    it('ไม่ส่ง header: 401', async () => {
      await ctx.http().get('/api/equipment').expect(401);
    });

    it('user ที่ไม่มีในระบบ: 401', async () => {
      await ctx
        .http()
        .get('/api/equipment')
        .set('X-User-Id', '999')
        .expect(401);
    });
  });

  describe('GET /equipment', () => {
    it('daysUntilDue นับจากวันนี้ของ backend และเปลี่ยนตามกำหนดใหม่หลังอนุมัติ', async () => {
      const psv = await equipment('PSV-1003');
      expect(psv.daysUntilDue).toBe(daysBetween(ctx.today, psv.nextDueDate));

      await submitAndApprove(psv.id, addDays(psv.nextDueDate, 10), SUPERVISOR);
      expect((await equipment('PSV-1003')).daysUntilDue).toBe(
        psv.daysUntilDue + 10,
      );

      // seed.sql ตั้ง PSV-1002 ไว้ที่ CURRENT_DATE - 3 (เลยกำหนด 3 วัน)
      expect((await equipment('PSV-1002')).daysUntilDue).toBe(-3);
    });
  });

  describe('ยื่น / อนุมัติ / ปฏิเสธ', () => {
    it('อนุมัติแล้ว กำหนดตรวจสอบของอุปกรณ์อัปเดตตามที่ขอ', async () => {
      const pump = await equipment('PMP-2002'); // Criticality B
      const newDate = addDays(pump.nextDueDate, 10);

      const created = await submit(REQUESTER, pump.id, newDate);
      expect(created.status).toBe(201);
      const body = created.body as RequestBody;
      expect(body).toMatchObject({
        status: 'PENDING',
        previousDueDate: pump.nextDueDate,
        requestedDueDate: newDate,
        requiredApproverRole: 'supervisor',
      });
      expect((await equipment('PMP-2002')).pendingRequestId).toBe(body.id);

      const approved = await decide('approve', SUPERVISOR, body.id);
      expect(approved.status).toBe(200);
      expect(approved.body).toMatchObject({
        status: 'APPROVED',
        decidedById: SUPERVISOR,
      });

      const after = await equipment('PMP-2002');
      expect(after.nextDueDate).toBe(newDate);
      expect(after.cycleOriginalDueDate).toBe(pump.nextDueDate);
      expect(after.pendingRequestId).toBeNull();
    });

    it('ปฏิเสธแล้ว กำหนดตรวจสอบไม่เปลี่ยน', async () => {
      const pump = await equipment('PMP-2002');
      const created = await submit(
        REQUESTER,
        pump.id,
        addDays(pump.nextDueDate, 10),
      );

      const rejected = await decide(
        'reject',
        SUPERVISOR,
        (created.body as RequestBody).id,
      );
      expect(rejected.status).toBe(200);
      expect(rejected.body).toMatchObject({ status: 'REJECTED' });

      const after = await equipment('PMP-2002');
      expect(after.nextDueDate).toBe(pump.nextDueDate);
      expect(after.cycleOriginalDueDate).toBeNull();
    });

    it('ตัดสินคำขอเดิมซ้ำ: 409', async () => {
      const pump = await equipment('PMP-2002');
      const approved = await submitAndApprove(
        pump.id,
        addDays(pump.nextDueDate, 5),
        SUPERVISOR,
      );
      await decide('approve', SUPERVISOR, approved.id).expect(409);
      await decide('reject', SUPERVISOR, approved.id).expect(409);
    });

    it('requester อนุมัติไม่ได้: 403', async () => {
      const pump = await equipment('PMP-2002');
      const created = await submit(
        REQUESTER,
        pump.id,
        addDays(pump.nextDueDate, 5),
      );
      await decide('approve', 2, (created.body as RequestBody).id).expect(403);
    });

    it('ห้ามอนุมัติคำขอของตัวเอง: 403 แต่หัวหน้างานอีกคนอนุมัติได้', async () => {
      const pump = await equipment('PMP-2002');
      const created = await submit(
        SUPERVISOR,
        pump.id,
        addDays(pump.nextDueDate, 5),
      );
      const id = (created.body as RequestBody).id;
      await decide('approve', SUPERVISOR, id).expect(403);
      await decide('approve', SUPERVISOR_2, id).expect(200);
    });

    it('อุปกรณ์ที่มีคำขอรออนุมัติอยู่ ยื่นซ้ำไม่ได้: 409', async () => {
      const pump = await equipment('PMP-2002');
      await submit(REQUESTER, pump.id, addDays(pump.nextDueDate, 5)).expect(
        201,
      );
      await submit(REQUESTER, pump.id, addDays(pump.nextDueDate, 6)).expect(
        409,
      );
    });

    it('ยื่นพร้อมกันสองคำขอบนอุปกรณ์เดียวกัน: ผ่านแค่คำขอเดียว', async () => {
      const pump = await equipment('PMP-2002');
      const results = await Promise.all([
        submit(REQUESTER, pump.id, addDays(pump.nextDueDate, 5)),
        submit(2, pump.id, addDays(pump.nextDueDate, 7)),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    });

    it('ข้อมูลไม่ถูกต้อง: 400 / 404', async () => {
      const pump = await equipment('PMP-2002');
      // วันที่ไม่ได้เลื่อนออกไป
      await submit(REQUESTER, pump.id, pump.nextDueDate).expect(400);
      // ไม่มีเหตุผล
      await submit(
        REQUESTER,
        pump.id,
        addDays(pump.nextDueDate, 5),
        '   ',
      ).expect(400);
      // วันที่ไม่มีจริง
      await submit(REQUESTER, pump.id, '2027-02-30').expect(400);
      // ไม่มีอุปกรณ์นี้
      await submit(REQUESTER, 9999, addDays(ctx.today, 5)).expect(404);
    });
  });

  describe('นโยบายหมวด 4.2 (Criticality A)', () => {
    it('เลื่อน 30 วันพอดี: หัวหน้างานอนุมัติได้', async () => {
      const psv = await equipment('PSV-1003'); // A
      const created = await submit(
        REQUESTER,
        psv.id,
        addDays(psv.nextDueDate, 30),
      );
      expect(created.body).toMatchObject({
        requiredApproverRole: 'supervisor',
      });
      await decide(
        'approve',
        SUPERVISOR,
        (created.body as RequestBody).id,
      ).expect(200);
    });

    it('เลื่อน 31 วัน: หัวหน้างานอนุมัติไม่ได้ ต้องเป็นผู้จัดการฝ่าย', async () => {
      const psv = await equipment('PSV-1003');
      const newDate = addDays(psv.nextDueDate, 31);
      const created = await submit(REQUESTER, psv.id, newDate);
      expect(created.status).toBe(201);
      const body = created.body as RequestBody;
      expect(body.requiredApproverRole).toBe('department_manager');
      expect(body.escalationReason).toContain('31 วัน');

      const denied = await decide('approve', SUPERVISOR, body.id);
      expect(denied.status).toBe(403);
      expect((denied.body as ErrorBody).message).toContain('ผู้จัดการฝ่าย');
      // หัวหน้างานปฏิเสธแทนก็ไม่ได้
      await decide('reject', SUPERVISOR, body.id).expect(403);
      expect((await equipment('PSV-1003')).nextDueDate).toBe(psv.nextDueDate);

      await decide('approve', MANAGER, body.id).expect(200);
      expect((await equipment('PSV-1003')).nextDueDate).toBe(newDate);
    });

    it('ผู้จัดการฝ่ายคนเดียวยื่นคำขอที่เกินเงื่อนไขไม่ได้ เพราะไม่มีใครตัดสินได้', async () => {
      const psv = await equipment('PSV-1003');
      const res = await submit(MANAGER, psv.id, addDays(psv.nextDueDate, 31));
      expect(res.status).toBe(400);
      expect((res.body as ErrorBody).message).toContain('ไม่มีผู้จัดการฝ่ายคนอื่น');
      expect((await equipment('PSV-1003')).pendingRequestId).toBeNull();

      // คำขอที่หัวหน้างานตัดสินได้ ผู้จัดการฝ่ายยังยื่นได้ตามปกติ
      const ok = await submit(MANAGER, psv.id, addDays(psv.nextDueDate, 30));
      expect(ok.status).toBe(201);
      await decide('approve', SUPERVISOR, (ok.body as RequestBody).id).expect(
        200,
      );
    });

    it('เลื่อนครั้งที่ 2 นับ 30 วันสะสมจากกำหนดเดิม', async () => {
      const cmp = await equipment('CMP-3001'); // A
      const original = cmp.nextDueDate;
      await submitAndApprove(cmp.id, addDays(original, 20), SUPERVISOR);

      // ครั้งที่ 2 ขอต่ออีกแค่ 15 วัน แต่รวมเป็น 35 วันจากกำหนดเดิม
      const second = await submit(REQUESTER, cmp.id, addDays(original, 35));
      const body = second.body as RequestBody;
      expect(body.cycleOriginalDueDate).toBe(original);
      expect(body.requiredApproverRole).toBe('department_manager');
      await decide('approve', SUPERVISOR, body.id).expect(403);
    });

    it('เลื่อนได้ 2 ครั้งต่อรอบ ครั้งที่ 3 ต้องให้ผู้จัดการฝ่ายอนุมัติ', async () => {
      const cmp = await equipment('CMP-3001');
      const original = cmp.nextDueDate;

      const first = await submitAndApprove(
        cmp.id,
        addDays(original, 5),
        SUPERVISOR,
      );
      expect(first.requiredApproverRole).toBe('supervisor');

      const second = await submitAndApprove(
        cmp.id,
        addDays(original, 10),
        SUPERVISOR,
      );
      expect(second.requiredApproverRole).toBe('supervisor');

      // รวมแค่ 15 วัน แต่เป็นครั้งที่ 3 ในรอบเดียวกัน
      const third = await submit(REQUESTER, cmp.id, addDays(original, 15));
      const body = third.body as RequestBody;
      expect(body.cycleOriginalDueDate).toBe(original);
      expect(body.requiredApproverRole).toBe('department_manager');
      expect(body.escalationReason).toContain('ครั้งที่ 3');
      await decide('approve', SUPERVISOR, body.id).expect(403);
      await decide('approve', MANAGER, body.id).expect(200);
    });

    it('คำขอที่ถูกปฏิเสธ ไม่นับเป็นการเลื่อน', async () => {
      const cmp = await equipment('CMP-3001');
      const original = cmp.nextDueDate;
      for (let i = 1; i <= 3; i++) {
        const r = await submit(REQUESTER, cmp.id, addDays(original, i));
        await decide('reject', SUPERVISOR, (r.body as RequestBody).id).expect(
          200,
        );
      }
      const next = await submit(REQUESTER, cmp.id, addDays(original, 5));
      expect(next.body).toMatchObject({ requiredApproverRole: 'supervisor' });
    });

    it('อุปกรณ์ที่เลยกำหนดแล้วยังขอเลื่อนได้ แต่วันที่ใหม่ต้องอยู่หลังวันนี้', async () => {
      const overdue = await equipment('PSV-1001'); // A เลยกำหนดมา 12 วัน
      // +10 จากกำหนดเดิม ยังเป็นอดีต
      await submit(
        REQUESTER,
        overdue.id,
        addDays(overdue.nextDueDate, 10),
      ).expect(400);
      // +30 จากกำหนดเดิม = อนาคต และไม่เกินเพดาน
      const ok = await submit(
        REQUESTER,
        overdue.id,
        addDays(overdue.nextDueDate, 30),
      );
      expect(ok.status).toBe(201);
      expect(ok.body).toMatchObject({ requiredApproverRole: 'supervisor' });
    });

    it('Criticality B เลื่อนเกิน 30 วันหลายครั้ง หัวหน้างานยังอนุมัติได้', async () => {
      const crane = await equipment('CRN-7002'); // B
      const original = crane.nextDueDate;
      for (const days of [40, 80, 120]) {
        const approved = await submitAndApprove(
          crane.id,
          addDays(original, days),
          SUPERVISOR,
        );
        expect(approved.requiredApproverRole).toBe('supervisor');
      }
    });

    it('รายการรออนุมัติบอกได้ว่าผู้ใช้แต่ละคนตัดสินคำขอไหนได้', async () => {
      const psv = await equipment('PSV-1003');
      const pump = await equipment('PMP-2002');
      await submit(REQUESTER, psv.id, addDays(psv.nextDueDate, 45)).expect(201);
      await submit(REQUESTER, pump.id, addDays(pump.nextDueDate, 5)).expect(
        201,
      );

      const asSupervisor = await ctx
        .http()
        .get('/api/deferral-requests/pending')
        .set('X-User-Id', String(SUPERVISOR))
        .expect(200);
      const byRole = Object.fromEntries(
        (asSupervisor.body as PendingBody[]).map((r) => [
          r.requiredApproverRole,
          r.canDecide,
        ]),
      );
      expect(byRole).toEqual({ department_manager: false, supervisor: true });

      const asManager = await ctx
        .http()
        .get('/api/deferral-requests/pending')
        .set('X-User-Id', String(MANAGER))
        .expect(200);
      expect((asManager.body as PendingBody[]).every((r) => r.canDecide)).toBe(
        true,
      );
    });
  });
});
