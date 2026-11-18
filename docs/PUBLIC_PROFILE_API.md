# 공개 프로필 API (HODL-75)

기본 경로는 `/api/v1`입니다. 아래 API는 비로그인으로 조회할 수 있습니다.
`/me`, `/me/assets` 등 본인 정보 API의 인증 요구사항은 그대로 유지합니다.

| Method | Path | 응답 |
| --- | --- | --- |
| GET | `/members/{memberId}` | 회원 ID로 공개 프로필·활동 수·공개 보유 자산 조회 |
| GET | `/members/by-nickname/{nickname}` | 현재 닉네임으로 동일한 공개 프로필 조회 |
| GET | `/members/by-nickname?nickname={nickname}` | 기존 닉네임에 URL 예약 문자가 포함된 경우의 공개 프로필 조회 |
| GET | `/members/{memberId}/posts/page?page=0&size=20` | 작성한 공개 글 번호 페이지 |
| GET | `/members/{memberId}/comments/page?page=0&size=20` | 작성한 공개 댓글·답글 번호 페이지 |

## 프로필

공개 프로필 화면 `/user/{memberId}`는 같은 회원 ID로 프로필과 글·댓글을 조회합니다.
등록되지 않은 회원 ID는 `404`를 반환합니다. 본인 여부는 인증 회원의 ID와 비교합니다.

```json
{
  "id": 7,
  "nickname": "공개회원",
  "avatarColor": "#123456",
  "joinedAt": "2026-10-01T00:00:00Z",
  "postCount": 12,
  "commentCount": 34,
  "assets": [
    {
      "coinSymbol": "ETH",
      "coinName": "Ethereum",
      "quantityBand": "1~10 ETH",
      "holdingMonths": 3,
      "verificationLevel": "WALLET",
      "syncStatus": "READY",
      "capturedAt": "2026-10-24T00:00:00Z"
    }
  ]
}
```

- `joinedAt`: 가입 시각입니다.
- `postCount`, `commentCount`: 현재 활성 상태이면서 운영 중(`OPEN`)인 방의 공개 활동만 셉니다.
  댓글 수에는 답글도 포함하며 재게시·임시저장은 제외합니다. 목록과 같은 조건을 사용합니다.
- `assets`: 저장된 자산 스냅샷 중 활성 코인의 확인된 양수 보유(`HOLDER`)만 코인 표시 순서로 반환합니다.
  `PARTIAL`의 확인된 양수 부분합은 포함하며 `syncStatus`로 불완전 조회임을 표시합니다.
  `STALE`, `CACHED`, 미연결, 0잔액, 확인 실패 기록은 포함하지 않습니다.
  이 조회로 지갑·거래소를 호출하거나 보유 기록을 갱신하지 않습니다.
- 자산 정보는 `capturedAt` 기준의 마지막 확인 기록입니다. 실시간 잔액으로 표시하지 않습니다.
  `holdingMonths`도 해당 저장 시각 기준의 개월 수이며, 시작일을 모르면 `null`입니다.
- 회원의 기존 `assetVisibility=HIDDEN`이면 `assets=[]`입니다. `EXACT`, `RANGE` 모두
  이 공개 API에서는 수량 구간만 제공합니다. 지갑 주소, 정확 수량, 평가금액, 로그인 정보는 제공하지 않습니다.

## 글·댓글 페이지

공통 번호 페이지 계약을 사용합니다. `page`는 0부터, 기본 `size=20`, 허용 범위는 1~100입니다.
잘못된 범위·타입·과도한 offset은 공통 오류 형식(`message`, `timestamp`)의 `400`입니다.
회원이 없으면 `404`, 활동이 없거나 마지막 페이지를 넘으면 `200`과 빈 `items`를 반환합니다.
정렬은 `createdAt DESC, id DESC`로 고정합니다. 공사 중·비활성 방의 활동은 페이지를 자르기 전에 제외합니다.

```json
{
  "items": [
    {
      "id": 42,
      "coinSymbol": "ETH",
      "title": "작성한 글",
      "content": "본문",
      "createdAt": "2026-10-20T00:00:00Z",
      "updatedAt": "2026-10-20T00:00:00Z",
      "holderSnapshot": {
        "verificationAvailability": "SUPPORTED",
        "verificationLevel": "WALLET",
        "verifiedHolder": true,
        "quantityBand": "1~10 ETH",
        "holdingMonths": 3,
        "capturedAt": "2026-10-20T00:00:00Z",
        "syncStatus": "READY",
        "holderStatus": "HOLDER"
      }
    }
  ],
  "page": 0,
  "size": 20,
  "totalElements": 1,
  "totalPages": 1,
  "hasNext": false,
  "hasPrevious": false
}
```

댓글 항목은 `id`, `postId`, `postTitle`, `coinSymbol`, `content`, `createdAt`, `updatedAt`,
`parentCommentId`, `replyToCommentId`, `replyToNickname`, `holderSnapshot`을 반환합니다.
댓글의 `holderSnapshot`은 글과 같은 상태·기간 필드를 사용하되 기존 댓글 공개 계약에 따라
`quantityBand` 필드가 없습니다. 댓글에서 수량 구간을 공개하는 변경은 HODL-80에서 별도 진행합니다.

글 목록의 `attachedCoinSnapshots`는 코인별 작성 시점 기록 배열입니다. 방 코인 다음에 추가 선택 순서로
반환하며 자산 전체·코인별 공개 설정을 적용합니다. 필드는 `SOCIAL_API.md`의 첨부 코인 응답을 따릅니다.

글·댓글 `holderSnapshot`은 작성 시 저장한 기록을 그대로 사용하며 현재 보유량으로 재계산하지 않습니다.
기록이 없는 기존 콘텐츠와 현재 자산 비공개 회원의 기록은 `null`입니다. 공개 설정 변경은 저장된
과거 기록을 수정하지 않습니다. 일반 글 상세 응답의 정확 평가금액 필드는 이 프로필 목록에 포함하지 않습니다.

## 정책과 후속 연동

- 닉네임이 변경되어도 회원 ID는 유지됩니다. 닉네임 조회는 현재 저장된 값과 일치할 때 성공합니다.
- 새 닉네임 규칙에 맞지 않는 기존 값도 회원 ID로 조회됩니다. 기존 회원은 닉네임 변경 시 새 규칙을 적용받습니다.
  배포 전 운영 DB에서 아래 조회로 점검 후보를 찾을 수 있습니다. 한글 자모의 확장 문자 사용자는
  애플리케이션의 Hangul 스크립트 규칙으로 추가 확인합니다. 새 닉네임 입력 시 새 규칙을 검증합니다.

  ```sql
  SELECT id, nickname FROM members
  WHERE CHAR_LENGTH(nickname) < 2 OR CHAR_LENGTH(nickname) > 40
     OR nickname REGEXP '[^가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9_-]';
  ```
- 코인별 공개 토글은 아직 없으며 기존 회원 단위 공개 설정을 따릅니다.
- 대표 동물 등급 배지는 HODL-80의 등급 계약에 맞춰 후속 연동합니다. 현재 API는 기존 보유 구간·상태를 제공합니다.
- 공개 프로필의 ID 기반 화면 전환은 HODL-104에서 연동합니다.
- Liquibase `015-public-profile-indexes.sql`은 회원별 최신 활동 조회를 위한 글·댓글 복합 인덱스를 추가합니다.
