package com.cryptalk.poll;

import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.time.Instant;
import java.util.List;

public final class PollDtos {
    private PollDtos() {}
    public record CreatePollRequest(@NotBlank @Size(max=200) String question,
                                    @NotNull @Size(min=2,max=10) List<@NotBlank @Size(max=100) String> choices) {}
    public record VoteRequest(@NotNull @Positive Long choiceId) {}
    public record DailyResult(Long pollId, String coinSymbol, String question, boolean active,
                              LocalDate day, long totalVotes, List<ChoiceResponse> choices,
                              List<HolderResult> holderResults) {}
    public record HolderResult(String holderStatus, long totalVotes, List<ChoiceResponse> choices) {}
    public record VoteHistory(Long id, LocalDate day, Instant votedAt, Long choiceId,
                              String choiceLabel, DailyResult result) {}
    public record ChoiceResponse(Long id,String label,Long voteCount) {}
    public record PollResponse(Long id,String coinSymbol,String question,boolean active,LocalDate day,
                               boolean participatedToday,Long userChoiceId,Long totalVotes,List<ChoiceResponse> choices) {}
}
