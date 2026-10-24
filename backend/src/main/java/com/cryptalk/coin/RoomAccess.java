package com.cryptalk.coin;

import com.cryptalk.common.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class RoomAccess {
    private final CoinRepository coins;

    public RoomAccess(CoinRepository coins) { this.coins = coins; }

    public Coin requireOpen(String symbol) {
        Coin coin = coins.findBySymbolIgnoreCaseAndActiveTrue(symbol)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "코인 커뮤니티를 찾을 수 없습니다."));
        requireOpen(coin);
        return coin;
    }

    public void requireOpen(Coin coin) {
        if (!coin.isActive()) throw new ApiException(HttpStatus.NOT_FOUND, "코인 커뮤니티를 찾을 수 없습니다.");
        if (coin.getOperationStatus() != RoomOperationStatus.OPEN) {
            throw new ApiException(HttpStatus.FORBIDDEN, "ROOM_CLOSED", "현재 닫힌 방입니다.");
        }
    }
}
