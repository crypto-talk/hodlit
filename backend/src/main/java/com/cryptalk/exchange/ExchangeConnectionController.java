package com.cryptalk.exchange;

import com.cryptalk.common.ApiException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Locale;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/me/exchanges")
@Tag(name = "거래소 자산", description = "업비트·빗썸·코인원 API 키 연결 및 잔고 조회")
public class ExchangeConnectionController {
    private final ExchangeConnectionService service;

    public ExchangeConnectionController(ExchangeConnectionService service) { this.service = service; }

    @Operation(summary = "연결된 거래소 목록", description = "API 키는 응답에 포함하지 않습니다.")
    @GetMapping
    ResponseEntity<List<ExchangeConnectionService.ConnectionResponse>> list(@AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.list(id(jwt)));
    }

    @Operation(summary = "거래소 API 키 연결", description = "잔고 조회로 키를 확인한 뒤 암호화하여 저장합니다. 추가 권한이 없는지는 검증하지 못하므로 자산조회 전용 키만 사용하세요.")
    @PostMapping("/{exchange}")
    ResponseEntity<ExchangeConnectionService.ConnectionResponse> connect(@AuthenticationPrincipal Jwt jwt,
        @PathVariable String exchange, @Valid @RequestBody ConnectRequest request) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
            .body(service.connect(id(jwt), exchange(exchange), request.accessKey(), request.secretKey()));
    }

    @Operation(summary = "거래소 잔고 조회", description = "연결된 거래소의 현재 가용·잠금·전체 잔고를 조회합니다.")
    @GetMapping("/{exchange}/assets")
    ResponseEntity<ExchangeConnectionService.AssetResponse> assets(@AuthenticationPrincipal Jwt jwt,
        @PathVariable String exchange) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.assets(id(jwt), exchange(exchange)));
    }

    @Operation(summary = "거래소 API 키 연결 해제", description = "저장된 암호화 자격 증명을 삭제합니다.")
    @DeleteMapping("/{exchange}")
    ResponseEntity<Void> disconnect(@AuthenticationPrincipal Jwt jwt, @PathVariable String exchange) {
        service.disconnect(id(jwt), exchange(exchange));
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }

    private Exchange exchange(String name) {
        try {
            return Exchange.valueOf(name.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "지원하지 않는 거래소입니다.");
        }
    }

    private Long id(Jwt jwt) { return Long.valueOf(jwt.getSubject()); }

    public record ConnectRequest(@NotBlank @Size(max = 256) @Pattern(regexp = "^[!-~]+$") String accessKey,
                                 @NotBlank @Size(max = 256) @Pattern(regexp = "^[!-~]+$") String secretKey) {}
}
