package com.cryptalk.asset;

import java.math.BigInteger;
import java.time.Instant;
import java.util.List;

/** Private display projection; the provider result remains complete for internal verification. */
public record WalletAssetPortfolioResponse(List<AlchemyPortfolioClient.Token> assets,
                                          List<AlchemyPortfolioClient.Token> unresolvedAssets,
                                          List<String> failedNetworks, boolean paginationComplete,
                                          String syncStatus, Instant capturedAt) {
    public static WalletAssetPortfolioResponse from(AlchemyPortfolioClient.Result result) {
        var held = result.assets().stream().filter(token -> token.rawBalance() != null
            && new BigInteger(token.rawBalance()).signum() > 0).toList();
        var unresolved = result.assets().stream().filter(token -> token.rawBalance() == null).toList();
        return new WalletAssetPortfolioResponse(held, unresolved, result.failedNetworks(),
            result.paginationComplete(), result.syncStatus(), result.capturedAt());
    }
}
