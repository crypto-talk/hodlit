# 거래소 자산 조회 API

로그인 회원은 업비트, 빗썸, 코인원의 API Key/Secret Key를 연결하고 현재 잔고를 조회할 수 있습니다. 모든 경로는 `/api/v1/me/exchanges` 아래에 있으며 Bearer JWT가 필요합니다. 브라우저 테스트 화면은 `/test/exchanges`입니다 (`CRYPTALK_TEST_PAGES_ENABLED=true`일 때만 노출).

## 운영 설정

연결 기능을 사용하려면 서버의 `.env`에 `EXCHANGE_CREDENTIAL_ENCRYPTION_KEY`를 설정해야 합니다. `openssl rand -base64 32`로 생성한 32바이트 키의 Base64 값입니다. 설정되지 않으면 연결 시 503을 반환합니다. 키를 잃거나 바꾸면 기존에 암호화 저장된 연결을 복호화할 수 없으므로 별도로 안전하게 백업해야 합니다. 실제 거래소 API 호출 서버의 공개 IP를 각 API Key의 허용 IP에 등록해야 합니다.

API Key는 입력 시 계정 확인과 잔고 조회로 동작을 검증한 뒤 AES-256-GCM으로 암호화 저장합니다. 응답, 테스트 페이지 로그 및 일반 애플리케이션 로그에 키를 표시하지 않습니다. 목록에는 거래소와 연결 시각만 나옵니다. 재연결하면 같은 거래소의 키를 교체합니다. 연결 해제 시 저장된 암호문을 삭제합니다.

HODL-50부터 업비트·빗썸은 서버가 조회한 계정 식별자도 검사합니다. 서로 다른 키여도 같은 거래소 계정이 다른 회원에 연결되어 있으면 409입니다. 업비트는 **메인포켓에서 발급한 자산조회·포켓관리 권한 키**, 빗썸은 **API 1.0 회원정보·잔고조회 권한 키**가 필요합니다. 빗썸 API 2.0 키를 계정 확인에 사용할 수 있다고 가정하지 않습니다. 계정 ID·fingerprint는 응답과 로그에 포함하지 않습니다. 코인원은 계정 ID 연동이 유보되어 동일 API 키 중복만 차단합니다.

업비트 포켓관리 권한은 거래소에서 자산 이전 권한도 포함합니다. 이 서버는 조회만 호출하지만 일반 자산조회 키보다 넓은 권한임을 안내해야 합니다. 현재 사용자 본문은 기존 `{accessKey,secretKey}` 그대로이며 클라이언트가 계정 ID를 입력하지 않습니다.

기존 업비트·빗썸 연결은 계정 확인 전까지 자산 조회에 503을 반환하고 보유 인증에서는 UNKNOWN/PARTIAL로 처리됩니다. 재연결 또는 성공한 서버 backfill로 계정을 확인해야 합니다. 새 연결 시 다른 회원의 기존 미확인 연결을 조회할 수 없으면 503으로 거절합니다. 만료 키·빗썸 API 2.0 기존 연결은 해당 소유자의 재연결/해제가 필요합니다. 이미 발행된 글·댓글의 보유 스냅샷은 바뀌지 않습니다.

**권한 검증 한계:** 계정·잔고 조회 성공은 필요한 권한이 있음을 보여줄 뿐, 다른 권한이 없음을 증명하지 않습니다. 위 거래소별 계정 확인 및 잔고조회에 필요한 권한을 부여한 별도 키를 발급하고 주문·출금 권한은 부여하지 마세요. 이 API는 주문·출금·자산 이전 API를 호출하지 않습니다.

## 장애 진단

거래소 계정 미확인·키 만료·조회 실패는 통합 `GET /api/v1/me/assets`에서 HTTP 200과 `UNKNOWN/PARTIAL`로 처리합니다. 이때 해당 조회 실패 때문에 자산 갱신이나 글·댓글 발행 트랜잭션이 롤백되지 않습니다. 개별 거래소 자산 조회는 기존 오류 상태를 그대로 반환합니다(예: 계정 미확인 503). 데이터베이스 오류는 정상 부분 조회로 숨기지 않습니다.

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

거래소별 잔고 조회는 업비트 `GET /v1/accounts`, 빗썸 API 1.0 `POST /info/balance` (`currency=ALL`), 코인원 `POST /v2.1/account/balance/all`을 사용합니다. 업비트 `GET /v1/pockets`와 빗썸 `POST /info/account`는 계정 식별에 사용합니다. POST 조회 엔드포인트도 주문·출금·자산 이전을 생성하지 않습니다.

공식 문서: [업비트 잔고](https://docs.upbit.com/kr/reference/get-balance), [업비트 포켓](https://docs.upbit.com/kr/reference/list-pockets), [빗썸 회원 정보](https://apidocs.bithumb.com/v1.2.0/reference/회원-정보-조회), [빗썸 API 1.0 잔고](https://apidocs.bithumb.com/v1.2.0/reference/보유자산-조회), [코인원 전체 잔고](https://docs.coinone.co.kr/reference/find-balance).
