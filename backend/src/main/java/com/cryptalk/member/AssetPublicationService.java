package com.cryptalk.member;

import com.cryptalk.coin.CoinRepository;
import com.cryptalk.common.ApiException;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AssetPublicationService {
    private final MemberRepository members;
    private final CoinRepository coins;
    private final AssetPublicationPreferenceRepository preferences;
    public AssetPublicationService(MemberRepository members, CoinRepository coins, AssetPublicationPreferenceRepository preferences) {
        this.members = members;
        this.coins = coins;
        this.preferences = preferences;
    }
    @Transactional(readOnly = true)
    public List<Preference> list(Long actor) {
        if (!members.existsById(actor)) throw missing();
        var settings = preferences.findByMemberId(actor).stream().collect(java.util.stream.Collectors.toMap(AssetPublicationPreference::getCoinId, AssetPublicationPreference::isVisible));
        return coins.findByActiveTrueOrderByDisplayOrder().stream().map(c -> new Preference(c.getSymbol(), c.getName(), settings.getOrDefault(c.getId(), true))).toList();
    }
    @Transactional
    public Preference save(Long actor, String symbol, boolean visible) {
        members.lockById(actor).orElseThrow(this::missing);
        var coin = coins.findBySymbolIgnoreCaseAndActiveTrue(symbol).orElseThrow(this::missing);
        var setting = preferences.findByMemberIdAndCoinId(actor, coin.getId()).orElseGet(() -> new AssetPublicationPreference(actor, coin.getId(), visible));
        setting.setVisible(visible);
        preferences.save(setting);
        return new Preference(coin.getSymbol(), coin.getName(), visible);
    }
    @Transactional(readOnly = true)
    public boolean visible(Long memberId, Long coinId) {
        return preferences.findByMemberIdAndCoinId(memberId, coinId).map(AssetPublicationPreference::isVisible).orElse(true);
    }
    private ApiException missing() { return new ApiException(HttpStatus.NOT_FOUND, "회원 또는 코인을 찾을 수 없습니다."); }
    public record Preference(String symbol, String name, boolean visible) {}
}
