package com.cryptalk.common;

import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;

public record PageResponse<T>(List<T> items, int page, int size, long totalElements, int totalPages,
                              boolean hasNext, boolean hasPrevious) {
    public static PageRequest request(int page, int size, Sort sort) {
        if (page < 0 || size < 1 || size > 100 || (long) page * size > Integer.MAX_VALUE) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "page는 0 이상, size는 1~100이어야 합니다.");
        }
        return PageRequest.of(page, size, sort);
    }

    public static <T> PageResponse<T> of(Page<T> result) {
        return new PageResponse<>(result.getContent(), result.getNumber(), result.getSize(), result.getTotalElements(),
            result.getTotalPages(), result.hasNext(), result.hasPrevious());
    }
}
