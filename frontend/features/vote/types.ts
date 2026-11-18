/** 투표 선택지. `votes` 는 오늘 참여한 사람에게만 온다. 그 전에는 null. */
export type PollChoice = {
  id: number;
  label: string;
  votes: number | null;
};

/** 방의 현재 투표 (`GET /communities/{symbol}/poll`). */
export type RoomPoll = {
  id: number;
  symbol: string;
  question: string;
  /** 서버가 본 한국 날짜 `YYYY-MM-DD`. 결과는 이 날짜 하루치다. */
  day: string;
  /** 오늘(`day`) 참여했는지. */
  participated: boolean;
  myChoiceId: number | null;
  /** 오늘 참여자 수. 참여 전에는 null. */
  totalVotes: number | null;
  choices: PollChoice[];
};

/** 지난 결과의 선택지 한 줄. 0표도 온다. */
export type ResultChoice = {
  id: number;
  label: string;
  votes: number;
};

/**
 * 어느 날의 투표 결과 (`GET /communities/{symbol}/polls/results`, HODL-102).
 *
 * `holders` 는 투표할 때 그 코인을 들고 있다고 확인된 사람(`HOLDER`)만 따로 센 것이다.
 * 그런 참여자가 없던 날 · 보유 상태를 남기기 전의 기록이면 null.
 */
export type DailyPollResult = {
  pollId: number;
  symbol: string;
  question: string;
  /** 한국 날짜 `YYYY-MM-DD`. */
  day: string;
  totalVotes: number;
  choices: ResultChoice[];
  holders: { totalVotes: number; choices: ResultChoice[] } | null;
};

export type PollResultPage = {
  items: DailyPollResult[];
  /** 1부터. */
  page: number;
  totalPages: number;
  totalElements: number;
};

/** 내 투표 한 건 (`GET /me/votes`). `result` 는 그날의 지금 집계다(얼려 둔 값이 아니다). */
export type MyVote = {
  id: number;
  day: string;
  choiceId: number;
  choiceLabel: string;
  result: DailyPollResult | null;
};

export type MyVotePage = {
  items: MyVote[];
  page: number;
  totalPages: number;
  totalElements: number;
};
