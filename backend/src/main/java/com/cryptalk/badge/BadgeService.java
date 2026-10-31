package com.cryptalk.badge;

import com.cryptalk.admin.AdminAccess;
import com.cryptalk.asset.AssetSnapshot;
import com.cryptalk.coin.Coin;
import com.cryptalk.coin.CoinRepository;
import com.cryptalk.common.ApiException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BadgeService {
    private final BadgeTierRepository tiers;
    private final CoinRepository coins;
    private final AdminAccess admins;
    public BadgeService(BadgeTierRepository tiers, CoinRepository coins, AdminAccess admins) {
        this.tiers = tiers;
        this.coins = coins;
        this.admins = admins;
    }
    public static final List<String> ICONS = List.of("shrimp", "fish", "dolphin", "shark", "whale");
    public static final List<String> COLORS = List.of("coral", "mint", "blue", "purple", "gold");
    public static final List<String> EFFECTS = List.of("none", "soft", "border", "shine", "flow", "aurora");

    @Transactional(readOnly = true)
    public Config get(Long actor, String symbol) {
        admins.requireAdmin(actor);
        Coin coin = coins.findBySymbolIgnoreCaseAndActiveTrue(symbol).orElseThrow(this::notFound);
        return config(coin);
    }

    @Transactional
    public Config save(Long actor, String symbol, SaveRequest request) {
        admins.requireAdmin(actor);
        Coin coin = coins.lockBySymbol(symbol).orElseThrow(this::notFound);
        long current = tiers.latestVersion(coin.getId());
        if (request.expectedVersion() != current) throw new ApiException(HttpStatus.CONFLICT, "다른 관리자가 변경했습니다. 다시 조회해 주세요.");
        BigDecimal previous = null;
        for (var tier : request.tiers()) {
            BigDecimal minimum = tier.minimumQuantity();
            if ((previous == null && minimum.signum() != 0) || (previous != null && minimum.compareTo(previous) <= 0))
                throw bad("첫 경계는 0이어야 하고 이후 경계는 오름차순이어야 합니다.");
            if (!ICONS.contains(tier.icon()) || !COLORS.contains(tier.color()) || !EFFECTS.contains(tier.effect()))
                throw bad("허용되지 않은 디자인 프리셋입니다.");
            previous = minimum;
        }
        for (int i = 0; i < request.tiers().size(); i++) tiers.save(new BadgeTier(coin.getId(), current + 1, i, request.tiers().get(i)));
        tiers.flush();
        return config(coin);
    }

    @Transactional(readOnly = true)
    public BadgeSnapshot capture(Coin coin, AssetSnapshot asset) {
        if (asset == null || !"HOLDER".equals(asset.getHolderStatus()) || !asset.isVerified()
                || asset.getQuantity() == null || asset.getQuantity().signum() <= 0) return null;
        long version = tiers.latestVersion(coin.getId());
        var settings = tiers.findByCoinIdAndConfigVersionOrderByTierOrder(coin.getId(), version);
        for (int i = settings.size() - 1; i >= 0; i--) {
            var tier = settings.get(i);
            if (asset.getQuantity().compareTo(tier.getMinimumQuantity()) >= 0) {
                String lower = tier.getMinimumQuantity().stripTrailingZeros().toPlainString();
                String band = i + 1 == settings.size() ? lower + "+ " + coin.getSymbol()
                    : lower + "~" + settings.get(i + 1).getMinimumQuantity().stripTrailingZeros().toPlainString() + " " + coin.getSymbol();
                return new BadgeSnapshot(tier, band);
            }
        }
        return null;
    }

    private Config config(Coin coin) {
        long version = tiers.latestVersion(coin.getId());
        return new Config(coin.getSymbol(), version, tiers.findByCoinIdAndConfigVersionOrderByTierOrder(coin.getId(), version).stream()
            .map(t -> new TierRequest(t.getName(), t.getMinimumQuantity(), t.getIcon(), t.getColor(), t.getEffect())).toList());
    }
    private ApiException notFound() { return new ApiException(HttpStatus.NOT_FOUND, "방을 찾을 수 없습니다."); }
    private ApiException bad(String message) { return new ApiException(HttpStatus.BAD_REQUEST, message); }
    public record TierRequest(@NotBlank @Size(max = 40) String name,
            @NotNull @DecimalMin("0") @Digits(integer = 18, fraction = 18) BigDecimal minimumQuantity,
            @NotBlank String icon, @NotBlank String color, @NotBlank String effect) {}
    @io.swagger.v3.oas.annotations.media.Schema(name = "SaveBadgeConfigRequest")
    public record SaveRequest(@Min(0) long expectedVersion, @NotEmpty @Size(max = 20) List<@NotNull @Valid TierRequest> tiers) {}
    public record Config(String symbol, long version, List<TierRequest> tiers) {}
    public record Presets(List<String> icons, List<String> colors, List<String> effects) {}
}
