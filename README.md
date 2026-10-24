# CRYPTALK

이메일로 가입·로그인하고, 선택적으로 암호화폐 지갑을 연결해 코인 보유 여부와 자산 규모를 인증하는 코인별 커뮤니티입니다.

## 프로젝트 구조

```text
cryptalk/
├── frontend/   # Next.js/React 웹 애플리케이션
├── backend/    # Java 24 + Spring Boot API
└── docker-compose.yml
```

## Docker Compose 실행

이 서버의 Docker Compose는 백엔드와 MySQL만 실행합니다. 프론트엔드는 별도 환경에
배포하며, 이 저장소의 `frontend/` 소스는 개발 및 별도 배포를 위해 유지합니다.

```bash
cp .env.example .env
# .env의 비밀번호, JWT secret, public origin을 수정
docker compose up -d --build
docker compose ps
```

- API: `http://localhost:8080/api/v1` 또는 `.env`의 `BACKEND_PORT`
- Swagger: `http://localhost:8080/swagger-ui.html`
- MySQL은 외부에 노출되지 않습니다.

운영 HTTPS는 백엔드 앞단의 reverse proxy 또는 load balancer에서 종료하고,
`.env`의 `PUBLIC_ORIGIN`을 별도 배포한 프론트엔드 origin으로 설정하며
`AUTH_COOKIE_SECURE=true`를 설정하세요.

## 이 서버에서 자동 배포

`deploy-server.sh`는 `develop` 브랜치를 fast-forward로 갱신하고 백엔드 이미지를
빌드한 뒤 백엔드와 MySQL만 실행하고 health 상태를 확인합니다. Docker 권한이 없으면 처음에
`sudo` 비밀번호를 한 번만 요청하고 배포가 끝날 때까지 인증을 유지합니다. 비밀번호를
파일이나 환경 변수에 저장하지 않습니다.

```bash
cd /home/umbrel/cryptalk
./deploy-server.sh
```

다른 브랜치를 배포하려면 다음처럼 실행합니다.

```bash
CRYPTALK_BRANCH=release/0.0.1 ./deploy-server.sh
```

완전한 무인 배포가 필요하면 비밀번호를 저장하는 대신 root가 소유한 systemd 서비스나
CI runner를 별도로 구성해야 합니다. Docker 실행 권한 자체가 사실상 root 권한이므로
일반 사용자가 수정할 수 있는 스크립트에 광범위한 `NOPASSWD` sudo를 주지 마세요.

### GitHub Actions로 백엔드만 자동 배포

`develop` 브랜치의 백엔드 관련 파일이 변경되면
`.github/workflows/deploy-backend.yml`이 이 Umbrel 서버의 self-hosted runner에서
`deploy-backend.sh`를 실행합니다. Docker 이미지 빌드 중 테스트를 실행하고, 기존
MySQL은 유지한 채 백엔드 컨테이너만 교체한 후 health 상태를
확인합니다.

1. GitHub 저장소의 **Settings → Actions → Runners → New self-hosted runner**에서
   Linux x64를 선택합니다.
2. GitHub가 표시하는 다운로드 및 `config.sh` 명령을 `umbrel` 사용자로 실행합니다.
   Runner의 기본 작업 폴더는 저장소 밖(예: `/home/umbrel/actions-runner/_work`)을
   사용하세요.
3. 같은 안내 화면의 서비스 설치 명령으로 Runner를 등록하고 시작합니다.
4. Runner 사용자가 Docker를 비밀번호 없이 실행할 수 있게 한 뒤 Runner 서비스를
   재시작합니다. 이 서버에서 Runner를 `umbrel` 사용자로 등록했다면 다음과 같습니다.

```bash
sudo usermod -aG docker umbrel
sudo systemctl restart 'actions.runner.*'
```

5. `/home/umbrel/cryptalk/.env`의 운영 secret과 origin 설정을 확인합니다. secret은
   GitHub Actions 로그나 저장소에 복사하지 않습니다.
6. Runner를 처음 연결하는 경우 이 서버 checkout에 `deploy-backend.sh`가 있도록
   `develop`을 한 번 수동으로 pull합니다.
7. 이후 백엔드 관련 변경을 `develop`에 push하면 자동 배포됩니다. GitHub Actions
   화면의 **Run workflow**로 수동 재배포할 수도 있습니다.

Runner는 저장소의 workflow 코드를 서버에서 실행할 권한을 갖습니다. 이 workflow는
pull request가 아닌 보호된 `develop` 브랜치의 push에만 자동 실행되도록 유지하세요.

## GitHub에서 내려받아 재배포

배포 서버에서 GitHub 인증을 한 번 설정한 후 `deploy.sh`를 실행하면 private
저장소를 최초 clone하거나 최신 `main`을 fast-forward pull하고, 이미지를 다시
빌드한 다음 컨테이너를 교체합니다. GitHub 토큰은 `.env`나 Compose 파일에 넣지
않습니다.

```bash
chmod +x deploy.sh
CRYPTALK_DEPLOY_DIRECTORY="$HOME/cryptalk-deploy" ./deploy.sh
```

최초 실행은 `$CRYPTALK_DEPLOY_DIRECTORY/.env`를 생성하고 중단합니다. 해당 파일의
placeholder secret을 교체한 뒤 같은 명령을 다시 실행하세요.

다른 브랜치나 저장소를 배포할 때는 다음 변수를 사용할 수 있습니다.

```bash
CRYPTALK_BRANCH=main \
CRYPTALK_REPOSITORY_URL=https://github.com/ghwns9652/cryptalk.git \
CRYPTALK_DEPLOY_DIRECTORY="$HOME/cryptalk-deploy" \
./deploy.sh
```

수동 업데이트는 checkout 안에서 아래처럼 실행할 수도 있습니다.

```bash
git pull --ff-only
docker compose build --pull backend
docker compose up -d --remove-orphans
```

## 개발 환경 실행

백엔드는 Docker와 Java 24가 필요합니다. 프론트엔드 로컬 개발에는 Node.js 22.13
이상이 추가로 필요합니다.

```bash
docker compose up -d mysql

cd backend
./gradlew bootRun

cd frontend
npm install
npm run dev
```

프론트엔드는 `http://localhost:3000`, API와 Swagger UI는 각각
`http://localhost:8080`, `http://localhost:8080/swagger-ui.html`에서 확인할 수 있습니다.

## 구현 범위

- 이메일 회원가입·로그인 및 EVM 지갑 메시지 서명 로그인
- 가입 계정에 EVM 지갑을 선택적으로 연결하는 소유권 인증
- BCrypt 비밀번호 해시와 JWT/refresh cookie
- cursor 기반 랜딩·팔로잉 피드, 게시글·댓글 수정, 좋아요, 재게시, 북마크 API
- 소유권 기반 이미지·영상 관리와 게시글 삭제 시 실제 파일 정리
- 사용자 팔로우와 TradingView 분석·서버 조회 가격 스냅샷·YouTube Shorts 메타데이터
- CoinGecko 기반 KRW 실시간 시세·24시간 등락률과 Ethereum JSON-RPC 기반 ETH 잔액 인증
- 자산 공개 범위(정확한 금액/구간/비공개)와 게시 시점 자산 스냅샷
- MySQL 8.4 및 Liquibase 스키마 관리

실제 자산 인증을 사용하려면 백엔드에 `ETHEREUM_RPC_URL`을 설정해야 합니다.
설정하지 않은 경우 로그인과 커뮤니티 기능은 동작하지만 ETH 자산은
`UNAVAILABLE` 상태로 표시됩니다.

인증 API의 요청·응답과 cookie 명세는 [`docs/AUTH_API.md`](docs/AUTH_API.md)를
참고하세요.

SNS API의 엔드포인트와 게시글 요청·응답 명세는
[`docs/SOCIAL_API.md`](docs/SOCIAL_API.md)를 참고하세요.
