import {
  DeferralInput,
  decisionDeniedReason,
  evaluateDeferral,
  noDeciderReason,
} from './deferral-policy';

const TODAY = '2026-03-01';
const ORIGINAL_DUE = '2026-03-10';

/** คำขอเลื่อนครั้งแรกของอุปกรณ์ระดับ A แล้ว override เฉพาะส่วนที่ต้องการ */
function input(overrides: Partial<DeferralInput>): DeferralInput {
  return {
    criticality: 'A',
    currentDueDate: ORIGINAL_DUE,
    cycleOriginalDueDate: ORIGINAL_DUE,
    approvedDeferralsInCycle: 0,
    requestedDueDate: '2026-03-20',
    today: TODAY,
    ...overrides,
  };
}

function expectApprover(
  overrides: Partial<DeferralInput>,
  role: 'supervisor' | 'department_manager',
) {
  const result = evaluateDeferral(input(overrides));
  if (!result.ok) {
    throw new Error(`expected ok but got error: ${result.error}`);
  }
  expect(result.requiredApproverRole).toBe(role);
  return result;
}

describe('evaluateDeferral - นโยบายหมวด 4.2', () => {
  describe('Criticality A: เพดาน 30 วันนับจากกำหนดเดิม', () => {
    it('เลื่อน 10 วัน: หัวหน้างานอนุมัติได้', () => {
      const r = expectApprover(
        { requestedDueDate: '2026-03-20' },
        'supervisor',
      );
      expect(r.escalationReasons).toEqual([]);
    });

    it('เลื่อน 30 วันพอดี: หัวหน้างานอนุมัติได้ (ไม่เกิน 30)', () => {
      expectApprover({ requestedDueDate: '2026-04-09' }, 'supervisor');
    });

    it('เลื่อน 31 วัน: ต้องให้ผู้จัดการฝ่ายอนุมัติ', () => {
      const r = expectApprover(
        { requestedDueDate: '2026-04-10' },
        'department_manager',
      );
      expect(r.escalationReasons).toHaveLength(1);
      expect(r.escalationReasons[0]).toContain('31 วัน');
    });

    it('เลื่อนครั้งที่ 2 นับสะสมจากกำหนดเดิม ไม่ใช่จากวันที่เลื่อนไปแล้ว', () => {
      // เลื่อนครั้งแรกไป 03-30 (+20) แล้ว ขอต่ออีก 10 วันไป 04-09 = รวม 30 วัน
      expectApprover(
        {
          currentDueDate: '2026-03-30',
          approvedDeferralsInCycle: 1,
          requestedDueDate: '2026-04-09',
        },
        'supervisor',
      );
      // ขอต่ออีก 15 วันไป 04-14 = รวม 35 วัน ถึงครั้งนี้จะขอแค่ 15 วันก็เกินเพดาน
      expectApprover(
        {
          currentDueDate: '2026-03-30',
          approvedDeferralsInCycle: 1,
          requestedDueDate: '2026-04-14',
        },
        'department_manager',
      );
    });
  });

  describe('Criticality A: เลื่อนซ้ำได้ไม่เกิน 1 ครั้งต่อรอบ', () => {
    it('ครั้งที่ 1 และครั้งที่ 2 (เลื่อนซ้ำ 1 ครั้ง): หัวหน้างานอนุมัติได้', () => {
      expectApprover({ approvedDeferralsInCycle: 0 }, 'supervisor');
      expectApprover(
        {
          currentDueDate: '2026-03-15',
          approvedDeferralsInCycle: 1,
          requestedDueDate: '2026-03-20',
        },
        'supervisor',
      );
    });

    it('ครั้งที่ 3: ต้องให้ผู้จัดการฝ่ายอนุมัติ แม้รวมแล้วไม่เกิน 30 วัน', () => {
      const r = expectApprover(
        {
          currentDueDate: '2026-03-15',
          approvedDeferralsInCycle: 2,
          requestedDueDate: '2026-03-20',
        },
        'department_manager',
      );
      expect(r.escalationReasons).toHaveLength(1);
      expect(r.escalationReasons[0]).toContain('ครั้งที่ 3');
    });

    it('เกินทั้งสองเงื่อนไข: บอกเหตุผลครบทั้งสองข้อ', () => {
      const r = expectApprover(
        {
          currentDueDate: '2026-03-25',
          approvedDeferralsInCycle: 2,
          requestedDueDate: '2026-05-01',
        },
        'department_manager',
      );
      expect(r.escalationReasons).toHaveLength(2);
    });
  });

  describe('Criticality B และ C: นโยบาย 4.2 ไม่ครอบคลุม', () => {
    it.each(['B', 'C'] as const)(
      '%s: เลื่อน 90 วันเป็นครั้งที่ 5 หัวหน้างานยังอนุมัติได้',
      (criticality) => {
        expectApprover(
          {
            criticality,
            currentDueDate: '2026-03-20',
            approvedDeferralsInCycle: 4,
            requestedDueDate: '2026-06-08',
          },
          'supervisor',
        );
      },
    );
  });

  describe('อุปกรณ์ที่เลยกำหนดแล้ว', () => {
    const overdue = '2026-02-20'; // เลยกำหนดมา 9 วัน

    it('ยังขอเลื่อนได้ และนับ 30 วันจากกำหนดเดิมที่เลยมาแล้ว', () => {
      expectApprover(
        {
          currentDueDate: overdue,
          cycleOriginalDueDate: overdue,
          requestedDueDate: '2026-03-22', // +30 จากกำหนดเดิม
        },
        'supervisor',
      );
      expectApprover(
        {
          currentDueDate: overdue,
          cycleOriginalDueDate: overdue,
          requestedDueDate: '2026-03-23', // +31
        },
        'department_manager',
      );
    });

    it('วันที่ใหม่ที่ยังอยู่ในอดีต: ไม่รับคำขอ', () => {
      const r = evaluateDeferral(
        input({
          currentDueDate: overdue,
          cycleOriginalDueDate: overdue,
          requestedDueDate: '2026-02-25',
        }),
      );
      expect(r).toEqual({ ok: false, error: 'วันที่ใหม่ต้องอยู่หลังวันนี้' });
    });
  });

  describe('วันที่ที่ไม่ใช่การเลื่อน', () => {
    it.each([
      ['เท่ากับกำหนดปัจจุบัน', ORIGINAL_DUE],
      ['ก่อนกำหนดปัจจุบัน', '2026-03-05'],
    ])('%s: ไม่รับคำขอ', (_label, requestedDueDate) => {
      const r = evaluateDeferral(input({ requestedDueDate }));
      expect(r.ok).toBe(false);
    });

    it('วันที่ใหม่เท่ากับวันนี้: ไม่รับคำขอ', () => {
      const r = evaluateDeferral(
        input({
          currentDueDate: '2026-02-20',
          cycleOriginalDueDate: '2026-02-20',
          requestedDueDate: TODAY,
        }),
      );
      expect(r.ok).toBe(false);
    });
  });
});

describe('decisionDeniedReason - ใครตัดสินคำขอได้', () => {
  const base = { actorId: 3, requesterId: 1 };

  it('หัวหน้างานตัดสินคำขอปกติได้', () => {
    expect(
      decisionDeniedReason({
        ...base,
        actorRole: 'supervisor',
        requiredApproverRole: 'supervisor',
      }),
    ).toBeNull();
  });

  it('หัวหน้างานตัดสินคำขอที่เกินเงื่อนไขไม่ได้', () => {
    expect(
      decisionDeniedReason({
        ...base,
        actorRole: 'supervisor',
        requiredApproverRole: 'department_manager',
      }),
    ).toContain('ผู้จัดการฝ่าย');
  });

  it.each(['supervisor', 'department_manager'] as const)(
    'ผู้จัดการฝ่ายตัดสินคำขอที่ต้องการ %s ได้',
    (requiredApproverRole) => {
      expect(
        decisionDeniedReason({
          ...base,
          actorId: 5,
          actorRole: 'department_manager',
          requiredApproverRole,
        }),
      ).toBeNull();
    },
  );

  it('ผู้ยื่นคำขอ (requester) ตัดสินไม่ได้', () => {
    expect(
      decisionDeniedReason({
        ...base,
        actorId: 2,
        actorRole: 'requester',
        requiredApproverRole: 'supervisor',
      }),
    ).not.toBeNull();
  });

  it('ห้ามตัดสินคำขอของตัวเอง แม้เป็นผู้จัดการฝ่าย', () => {
    expect(
      decisionDeniedReason({
        actorId: 5,
        requesterId: 5,
        actorRole: 'department_manager',
        requiredApproverRole: 'supervisor',
      }),
    ).toContain('ของตัวเอง');
  });
});

describe('noDeciderReason - ต้องมีคนอื่นที่ตัดสินคำขอได้', () => {
  // ผู้ใช้ตาม seed.sql: ผู้จัดการฝ่ายมีคนเดียว (id 5)
  const users = [
    { id: 1, role: 'requester' },
    { id: 3, role: 'supervisor' },
    { id: 4, role: 'supervisor' },
    { id: 5, role: 'department_manager' },
  ] as const;

  it('ผู้จัดการฝ่ายคนเดียวยื่นคำขอที่เกินเงื่อนไข: ไม่มีใครตัดสินได้', () => {
    expect(
      noDeciderReason({
        requesterId: 5,
        requiredApproverRole: 'department_manager',
        users: [...users],
      }),
    ).toContain('ไม่มีผู้จัดการฝ่ายคนอื่น');
  });

  it('ผู้จัดการฝ่ายยื่นคำขอปกติ: หัวหน้างานตัดสินได้', () => {
    expect(
      noDeciderReason({
        requesterId: 5,
        requiredApproverRole: 'supervisor',
        users: [...users],
      }),
    ).toBeNull();
  });

  it('มีผู้จัดการฝ่ายคนอื่น: ยื่นคำขอที่เกินเงื่อนไขได้', () => {
    expect(
      noDeciderReason({
        requesterId: 5,
        requiredApproverRole: 'department_manager',
        users: [...users, { id: 6, role: 'department_manager' }],
      }),
    ).toBeNull();
  });

  it('หัวหน้างานยื่นคำขอปกติ: หัวหน้างานอีกคนหรือผู้จัดการฝ่ายตัดสินได้', () => {
    expect(
      noDeciderReason({
        requesterId: 3,
        requiredApproverRole: 'supervisor',
        users: [...users],
      }),
    ).toBeNull();
  });
});
