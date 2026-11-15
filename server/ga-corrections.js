// GA4 보정값: GA4가 놓치거나 잃어버린 날의 숫자를 다른 기록으로 복원해 관리실 통계에 더한다.
// 지금은 2026-11-12 한 건. GA4 일일 처리 뒤 그날 데이터가 통째로 사라졌는데(Google 쪽 문제, 커뮤니티 신고 2026-11-15),
// 11/12 22:14(KST)에 Data API로 조회해 둔 「최근 7일」 값과 지금 같은 기간 값의 차이로 그날 몫 일부를 되살렸다.
// - 방문자 · 세션 · 페이지뷰 · 머문 시간은 당시 기록이 없어 복원하지 못했다 (0 그대로).
// - users 는 「그날만 다녀간 사람」 기준이라 기간 합계에 더해도 중복이 생기지 않는다.
// GA4가 그날을 다시 처리해 데이터가 돌아오면 이 항목을 지운다 (이중으로 세지 않게).
export const GA_CORRECTIONS = [
  {
    date: '2026-11-12',
    note: '11/12 GA4 데이터 소실분 중 일부를 당일 22:14 조회 기록으로 복원해 더했어요 (방문자 · 세션은 복원 불가)',
    events: {
      wood_store: { count: 19, users: 3 },
      quest_done: { count: 9, users: 3 },
      share: { count: 1, users: 1 },
    },
    extras: {
      quests: { '첫 모닥불': { count: 3, users: 3 }, '3분 불멍': { count: 2, users: 2 }, '모닥불 음악': { count: 1, users: 1 }, '밤하늘 올려다보기': { count: 1, users: 1 }, '장작 20개': { count: 1, users: 1 }, '장작 맡기기': { count: 1, users: 1 } },
      store: { put: { count: 13, users: 3 }, take: { count: 6, users: 3 } },
      share: { share: { count: 1, users: 1 } },
    },
  },
];

const RANGE_DAYS = { today: 0, '7d': 6, '28d': 27 };
const dayKST = (t) => new Date(t + 9 * 3600_000).toISOString().slice(0, 10);

function addList(list, add) {
  if (!Array.isArray(list) || !add) return list;
  const out = list.map((x) => ({ ...x }));
  for (const [name, v] of Object.entries(add)) {
    const row = out.find((x) => x.name === name);
    if (row) { row.count += v.count; row.users += v.users; } else out.push({ name, count: v.count, users: v.users });
  }
  return out.sort((a, b) => b.count - a.count);
}

/** report() 결과에 보정값을 더한다. 기간에 해당 날짜가 들어갈 때만 */
export function applyCorrections(range, r, now = Date.now()) {
  const days = RANGE_DAYS[range] ?? 6;
  const end = dayKST(now), start = dayKST(now - days * 86400_000);
  // 안전장치: GA4가 그날을 다시 처리해 방문자가 다시 보이면 보정하지 않는다 (이중으로 세지 않게)
  const restored = (date) => (r.trend || []).some((t) => t.date === date.replace(/-/g, '') && t.users > 0);
  const hits = GA_CORRECTIONS.filter((c) => c.date >= start && c.date <= end && !restored(c.date));
  if (!hits.length) return r;
  const out = { ...r, corrections: hits.map((c) => ({ date: c.date, note: c.note })) };
  for (const c of hits) {
    out.events = (out.events || []).map((e) => (c.events[e.name] ? { ...e, count: e.count + c.events[e.name].count, users: e.users + c.events[e.name].users } : e));
    if (out.extras && !out.extras.error) {
      out.extras = {
        ...out.extras,
        quests: addList(out.extras.quests, c.extras.quests),
        store: addList(out.extras.store, c.extras.store),
        share: addList(out.extras.share, c.extras.share),
      };
    }
  }
  return out;
}
