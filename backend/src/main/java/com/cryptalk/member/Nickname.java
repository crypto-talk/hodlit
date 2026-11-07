package com.cryptalk.member;

public final class Nickname {
    public static final String PATTERN = "[\\p{IsHangul}A-Za-z0-9_-]+";
    public static final String INVALID_CHARACTERS = "닉네임에는 한글, 영문, 숫자, 밑줄, 하이픈만 사용할 수 있습니다.";

    private Nickname() {}

    public static String normalize(String value) {
        return value == null ? null : value.strip();
    }
}
