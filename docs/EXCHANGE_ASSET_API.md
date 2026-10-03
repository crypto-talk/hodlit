# 거래소 자산 조회 API

로그인 회원은 업비트, 빗썸, 코인원의 API Key/Secret Key를 연결하고 현재 잔고를 조회할 수 있습니다. 모든 경로는 `/api/v1/me/exchanges` 아래에 있으며 Bearer JWT가 필요합니다. 브라우저 테스트 화면은 `/test/exchanges`입니다 (`CRYPTALK_TEST_PAGES_ENABLED=true`일 때만 노출).

## 운영 설정

연결 기능을 사용하려면 서버의 `.env`에 `EXCHANGE_CREDENTIAL_ENCRYPTION_KEY`를 설정해야 합니다. `openssl rand -base64 32`로 생성한 32바이트 키의 Base64 값입니다. 설정되지 않으면 연결 시 503을 반환합니다. 키를 잃거나 바꾸면 기존에 암호화 저장된 연결을 복호화할 수 없으므로 별도로 안전하게 백업해야 합니다. 실제 거래소 API 호출 서버의 공개 IP를 각 API Key의 허용 IP에 등록해야 합니다.

API Key는 입력 시 잔고 조회를 먼저 호출해 동작을 확인한 뒤 AES-256-GCM으로 암호화 저장합니다. 응답, 테스트 페이지 로그 및 일반 애플리케이션 로그에 키를 표시하지 않습니다. 목록에는 거래소와 연결 시각만 나옵니다. 재연결하면 같은 거래소의 키를 교체합니다. 연결 해제 시 저장된 암호문을 삭제합니다.

**권한 검증 한계:** 잔고 조회 성공은 해당 권한이 있음을 보여줄 뿐, 주문·출금 등 다른 권한이 없음을 증명하지 않습니다. 반드시 자산조회/잔고조회 권한만 부여한 별도 키를 발급하세요. 이 API는 주문·출금 API를 호출하지 않습니다.

## 장애 진단

거래소 HTTP 오류는 WARN 로그에 거래소 이름(`exchange`), 거래소 HTTP 상태(`status`), 허용 목록에 포함된 오류 코드(`errorCode`)만 기록합니다. 예: `exchange=BITHUMB, status=403, errorCode=ip_address_not_allowed`. 알 수 없는 코드나 JSON이 아닌 응답은 `errorCode=unknown`으로 표시하며, 네트워크/전송 오류는 `status=unavailable, errorCode=transport_error`로 표시합니다. 코인원의 HTTP 200 실패 응답은 `exchange=COINONE, status=200, errorCode=unknown`으로 표시합니다.

API Key, Secret Key, Authorization 헤더, 잔고, 거래소 응답 본문 전체 및 예외 메시지는 기록하지 않습니다. API 오류 응답과 상태 코드는 변경하지 않습니다. 로그가 없다는 사실만으로 요청 미도달을 판단하지 마세요. 성공 및 모든 응답 형식 오류를 로깅하는 것은 아닙니다.

## 엔드포인트

| 메서드 | 경로 | 동작 |
| --- | --- | --- |
| `POST` | `/{exchange}` | 키 연결 또는 교체. 본문: `{"accessKey":"...","secretKey":"..."}` |
| `GET` | `/` | 내 거래소 연결 목록 |
| `GET` | `/{exchange}/assets` | 실시간 잔고 조회 |
| `DELETE` | `/{exchange}` | 키 연결 해제 |

`exchange`는 `upbit`, `bithumb`, `coinone` 중 하나입니다(대소문자 무관). 잔고 응답은 `{exchange, balances, fetchedAt}`이며 각 잔고는 `{currency, available, locked, total}`입니다. `currency`는 1~20자의 영숫자 통화 코드이며 대문자로 정규화합니다. `P`처럼 한 글자인 코드도 허용합니다. `total = available + locked`이고 금액 평가나 원화 환산은 하지 않습니다. 조회 실패 시 기존에 저장된 키를 노출하지 않고 오류만 반환합니다. 연결·목록·잔고 응답은 `Cache-Control: no-store`를 사용합니다.

거래소별 조회는 업비트 `GET /v1/accounts`, 빗썸 `GET /v1/accounts`, 코인원 `POST /v2.1/account/balance/all`을 사용합니다. 코인원의 조회 엔드포인트는 HTTP 메서드가 `POST`이지만 주문을 생성하지 않습니다.

공식 문서: [업비트 잔고](https://docs.upbit.com/kr/reference/get-balance), [빗썸 전체 자산](https://apidocs.bithumb.com/reference/%EC%A0%84%EC%B2%B4-%EC%9E%90%EC%82%B0-%EC%A1%B0%ED%9A%8C), [코인원 전체 잔고](https://docs.coinone.co.kr/v1.1/reference/v21).
