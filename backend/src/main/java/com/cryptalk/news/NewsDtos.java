package com.cryptalk.news;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;

public final class NewsDtos {
    private NewsDtos() {}
    public record SaveNewsRequest(@NotBlank @Size(max=200) String title,
                                  @NotBlank @Size(max=1000) String summary,
                                  @NotBlank @Size(max=100) String sourceName,
                                  @NotBlank @Size(max=1000) String sourceUrl) {}
    public record NewsResponse(Long id, String coinSymbol, String title, String summary, String sourceName,
                               String sourceUrl, Instant createdAt, Instant updatedAt) {}
    public record NewsPage(List<NewsResponse> items, int page, int size, long totalElements, int totalPages,
                           boolean hasNext, boolean hasPrevious) {}
}
