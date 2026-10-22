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
