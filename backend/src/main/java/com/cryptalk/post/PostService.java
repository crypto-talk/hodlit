package com.cryptalk.post;

import com.cryptalk.asset.AssetService;
import com.cryptalk.asset.AssetSnapshot;
import com.cryptalk.coin.Coin;
import com.cryptalk.coin.CoinRepository;
import com.cryptalk.comment.CommentRepository;
import com.cryptalk.common.ApiException;
import com.cryptalk.market.MarketPriceService;
import com.cryptalk.market.MarketPriceService.PriceQuote;
import com.cryptalk.media.MediaService;
import com.cryptalk.member.AssetVisibility;
import com.cryptalk.member.Member;
import com.cryptalk.member.MemberRepository;
import com.cryptalk.post.PostDtos.AuthorResponse;
import com.cryptalk.post.PostDtos.CreatePostRequest;
import com.cryptalk.post.PostDtos.FeedItemResponse;
import com.cryptalk.post.PostDtos.FeedPageResponse;
import com.cryptalk.post.PostDtos.HolderSnapshotResponse;
import com.cryptalk.post.PostDtos.MediaRequest;
import com.cryptalk.post.PostDtos.MediaResponse;
import com.cryptalk.post.PostDtos.PostResponse;
import com.cryptalk.post.PostDtos.PriceSnapshotResponse;
import com.cryptalk.post.PostDtos.TradingViewResponse;
import com.cryptalk.post.PostDtos.UpdatePostRequest;
import com.cryptalk.post.PostDtos.YoutubeResponse;
import com.cryptalk.social.FollowRepository;
import java.math.BigDecimal;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.text.NumberFormat;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PostService {
    private static final Pattern YOUTUBE = Pattern.compile("^(?:https://)?(?:www\\.)?(?:youtube\\.com/(?:shorts/|watch\\?v=)|youtu\\.be/)([A-Za-z0-9_-]{11})(?:[?&].*)?$");
    private static final Comparator<FeedEvent> FEED_ORDER = (left, right) -> {
        int time = right.occurredAt().compareTo(left.occurredAt());
        if (time != 0) return time;
        int type = Integer.compare(right.type().rank, left.type().rank);
        if (type != 0) return type;
        int post = Long.compare(right.post().getId(), left.post().getId());
        if (post != 0) return post;
        return Long.compare(right.actor().getId(), left.actor().getId());
    };

    private final PostRepository posts;
    private final PostLikeRepository likes;
    private final CommentRepository comments;
    private final PostMediaRepository postMedia;
    private final PostBookmarkRepository bookmarks;
    private final PostRepostRepository reposts;
    private final MemberRepository members;
    private final CoinRepository coins;
    private final AssetService assets;
    private final MediaService mediaFiles;
    private final MarketPriceService marketPrices;
    private final FollowRepository follows;
    private final PostHolderSnapshotRepository holderSnapshots;

    public PostService(PostRepository posts, PostLikeRepository likes, CommentRepository comments,
                       MemberRepository members, CoinRepository coins,
                       AssetService assets, PostMediaRepository postMedia,
                       PostBookmarkRepository bookmarks, PostRepostRepository reposts,
                       MediaService mediaFiles, MarketPriceService marketPrices, FollowRepository follows,
                       PostHolderSnapshotRepository holderSnapshots) {
        this.posts = posts; this.likes = likes; this.comments = comments; this.members = members;
        this.coins = coins; this.assets = assets; this.postMedia = postMedia;
        this.bookmarks = bookmarks; this.reposts = reposts; this.mediaFiles = mediaFiles;
        this.marketPrices = marketPrices; this.follows = follows; this.holderSnapshots = holderSnapshots;
    }

    @Transactional(readOnly = true)
    public List<PostResponse> list(String symbol, Long viewerId, int size) {
        if (coins.findBySymbolIgnoreCaseAndActiveTrue(symbol).isEmpty())
            throw new ApiException(HttpStatus.NOT_FOUND, "코인 커뮤니티를 찾을 수 없습니다.");
        return posts.findByCoinSymbolIgnoreCaseOrderByCreatedAtDesc(symbol, PageRequest.of(0, bounded(size)))
            .stream().map(post -> response(post, viewerId)).toList();
    }

    @Transactional(readOnly = true)
    public FeedPageResponse feed(Long viewerId, String cursor, int size) {
        return feedPage(viewerId, cursor, size, null);
    }

    @Transactional(readOnly = true)
    public FeedPageResponse followingFeed(Long memberId, String cursor, int size) {
        member(memberId);
        return feedPage(memberId, cursor, size, follows.findFollowingMemberIds(memberId));
    }

    @Transactional(readOnly = true)
    public PostResponse get(Long postId, Long viewerId) { return response(post(postId), viewerId); }

    @Transactional
    public PostResponse create(Long memberId, CreatePostRequest request) {
        Member member = member(memberId);
        Coin coin = coins.findBySymbolIgnoreCaseAndActiveTrue(request.coinSymbol())
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "코인 커뮤니티를 찾을 수 없습니다."));
        AssetSnapshot snapshot = assets.snapshotForPublication(memberId, coin);
        boolean verified = snapshot != null && snapshot.isVerified();
        // Exchange-backed aggregate quantities are public only as bands, never inferable exact valuations.
        BigDecimal value = verified && snapshot.getExchangeCount() == 0 && "READY".equals(snapshot.getSyncStatus())
            ? snapshot.getValueKrw() : null;
        YoutubeData youtube = youtube(request.youtubeUrl());
        PriceQuote quote = marketPrices.currentPrice(coin, request.assetPriceCurrency());
        Post saved = posts.save(new Post(member, coin, request.title().trim(), request.content().trim(), value, verified,
            clean(request.tradingViewSymbol()), clean(request.tradingViewInterval()), clean(request.tradingViewAnalysis()),
            quote.price(), quote.currency(), quote.capturedAt(), quote.source(),
            youtube == null ? null : youtube.url(), youtube == null ? null : youtube.videoId(),
            youtube == null ? null : youtube.thumbnailUrl()));
        holderSnapshots.save(new PostHolderSnapshot(saved, snapshot));
        saveMedia(memberId, saved, request.media(), Set.of());
        return response(saved, memberId);
    }

    @Transactional
    public PostResponse update(Long memberId, Long postId, UpdatePostRequest request) {
        Post post = post(postId);
        own(memberId, post.getMember().getId());
        YoutubeData youtube = youtube(request.youtubeUrl());
        post.update(request.title(), request.content(), clean(request.tradingViewSymbol()),
            clean(request.tradingViewInterval()), clean(request.tradingViewAnalysis()), youtube == null ? null : youtube.url(),
            youtube == null ? null : youtube.videoId(), youtube == null ? null : youtube.thumbnailUrl());
        replaceMedia(memberId, post, request.media());
        return response(post, memberId);
    }

    @Transactional
    public void delete(Long memberId, Long postId) {
        Post post = post(postId);
        own(memberId, post.getMember().getId());
        List<String> mediaUrls = new ArrayList<>(postMedia.findUrlsByPostId(postId));
        mediaUrls.addAll(postMedia.findThumbnailUrlsByPostId(postId));
        mediaFiles.deleteManagedAfterCommit(mediaUrls);
        posts.delete(post);
    }

    @Transactional
    public PostResponse like(Long memberId, Long postId) {
        Post post = post(postId); PostLikeId id = new PostLikeId(postId, memberId);
        if (!likes.existsById(id)) likes.save(new PostLike(post, member(memberId)));
        return response(post, memberId);
    }

    @Transactional
    public PostResponse unlike(Long memberId, Long postId) {
        likes.deleteById(new PostLikeId(postId, memberId)); return response(post(postId), memberId);
    }

    @Transactional
    public PostResponse bookmark(Long memberId, Long postId) {
        Post post = post(postId); PostMemberId id = new PostMemberId(postId, memberId);
        if (!bookmarks.existsById(id)) bookmarks.save(new PostBookmark(post, member(memberId)));
        return response(post, memberId);
    }

    @Transactional
    public PostResponse unbookmark(Long memberId, Long postId) {
        bookmarks.deleteById(new PostMemberId(postId, memberId)); return response(post(postId), memberId);
    }

    @Transactional(readOnly = true)
    public List<PostResponse> bookmarks(Long memberId) {
        member(memberId);
        return bookmarks.findByMemberIdOrderByCreatedAtDesc(memberId).stream()
            .map(item -> response(item.getPost(), memberId)).toList();
    }

    @Transactional
    public PostResponse repost(Long memberId, Long postId) {
        Post post = post(postId); PostMemberId id = new PostMemberId(postId, memberId);
        if (!reposts.existsById(id)) reposts.save(new PostRepost(post, member(memberId)));
        return response(post, memberId);
    }

    @Transactional
    public PostResponse unrepost(Long memberId, Long postId) {
        reposts.deleteById(new PostMemberId(postId, memberId)); return response(post(postId), memberId);
    }

    public Post post(Long id) {
        return posts.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "게시글을 찾을 수 없습니다."));
    }

    public Member member(Long id) {
        return members.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "회원을 찾을 수 없습니다."));
    }

    public void own(Long actor, Long owner) {
        if (!actor.equals(owner)) throw new ApiException(HttpStatus.FORBIDDEN, "작성자만 변경하거나 삭제할 수 있습니다.");
    }

    private FeedPageResponse feedPage(Long viewerId, String cursorValue, int requestedSize, List<Long> followingIds) {
        int size = bounded(requestedSize);
        FeedCursor cursor = decodeCursor(cursorValue);
        if (followingIds != null && followingIds.isEmpty()) return new FeedPageResponse(List.of(), null, false);
        int fetchSize = Math.min(size * 3 + 3, 303);
        PageRequest page = PageRequest.of(0, fetchSize);
        Instant before = cursor == null ? null : cursor.occurredAt();

        List<Post> postEvents;
        List<PostRepost> repostEvents;
        if (followingIds == null) {
            postEvents = before == null ? posts.findAllByOrderByCreatedAtDescIdDesc(page)
                : posts.findByCreatedAtLessThanEqualOrderByCreatedAtDescIdDesc(before, page);
            repostEvents = before == null ? reposts.findFeed(page) : reposts.findFeedBefore(before, page);
        } else {
            postEvents = before == null ? posts.findFollowing(followingIds, page)
                : posts.findFollowingBefore(followingIds, before, page);
            repostEvents = before == null ? reposts.findFollowing(followingIds, page)
                : reposts.findFollowingBefore(followingIds, before, page);
        }

        List<FeedEvent> events = new ArrayList<>(postEvents.size() + repostEvents.size());
        postEvents.forEach(post -> events.add(new FeedEvent(FeedType.POST, post.getCreatedAt(), post.getMember(), post)));
        repostEvents.forEach(repost -> events.add(new FeedEvent(FeedType.REPOST, repost.getCreatedAt(), repost.getMember(), repost.getPost())));
        events.sort(FEED_ORDER);
        if (cursor != null) events.removeIf(event -> compare(event, cursor) <= 0);

        boolean hasMore = events.size() > size;
        List<FeedEvent> selected = events.subList(0, Math.min(size, events.size()));
        List<FeedItemResponse> items = selected.stream().map(event -> new FeedItemResponse(
            event.type().name(), event.occurredAt(), author(event.actor()), response(event.post(), viewerId))).toList();
        String nextCursor = hasMore && !selected.isEmpty() ? encodeCursor(selected.get(selected.size() - 1)) : null;
        return new FeedPageResponse(items, nextCursor, hasMore);
    }

    private int compare(FeedEvent event, FeedCursor cursor) {
        int time = cursor.occurredAt().compareTo(event.occurredAt());
        if (time != 0) return time;
        int type = Integer.compare(cursor.type().rank, event.type().rank);
        if (type != 0) return type;
        int post = Long.compare(cursor.postId(), event.post().getId());
        if (post != 0) return post;
        return Long.compare(cursor.actorId(), event.actor().getId());
    }

    private String encodeCursor(FeedEvent event) {
        String raw = event.occurredAt() + "|" + event.type().name() + "|" + event.post().getId() + "|" + event.actor().getId();
        return Base64.getUrlEncoder().withoutPadding().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
    }

    private FeedCursor decodeCursor(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            String raw = new String(Base64.getUrlDecoder().decode(value), StandardCharsets.UTF_8);
            String[] parts = raw.split("\\|", -1);
            if (parts.length != 4) throw new IllegalArgumentException();
            return new FeedCursor(Instant.parse(parts[0]), FeedType.valueOf(parts[1]),
                Long.parseLong(parts[2]), Long.parseLong(parts[3]));
        } catch (RuntimeException exception) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "올바르지 않은 피드 cursor입니다.");
        }
    }

    private void saveMedia(Long memberId, Post post, List<MediaRequest> requests, Set<String> existingUrls) {
        if (requests == null) return;
        Set<String> urls = new HashSet<>();
        for (int index = 0; index < requests.size(); index++) {
            MediaRequest item = requests.get(index);
            if (item.type() == null) throw new ApiException(HttpStatus.BAD_REQUEST, "미디어 형식이 필요합니다.");
            validateMediaUrl(item.url());
            if (!urls.add(item.url())) throw new ApiException(HttpStatus.BAD_REQUEST, "같은 미디어를 중복 등록할 수 없습니다.");
            if (item.thumbnailUrl() != null) validateMediaUrl(item.thumbnailUrl());
            mediaFiles.claim(memberId, post, item.url(), existingUrls.contains(item.url()));
            if (item.thumbnailUrl() != null) {
                mediaFiles.claim(memberId, post, item.thumbnailUrl(), existingUrls.contains(item.thumbnailUrl()));
            }
            postMedia.save(new PostMedia(post, item.type(), item.url(), item.thumbnailUrl(), index));
        }
    }

    private void replaceMedia(Long memberId, Post post, List<MediaRequest> requests) {
        List<PostMedia> existing = postMedia.findByPostIdOrderByDisplayOrder(post.getId());
        Set<String> existingUrls = new LinkedHashSet<>(mediaUrls(existing));
        Set<String> retained = new LinkedHashSet<>();
        if (requests != null) {
            requests.forEach(item -> { retained.add(item.url()); if (item.thumbnailUrl() != null) retained.add(item.thumbnailUrl()); });
        }
        List<String> removed = mediaUrls(existing).stream().filter(url -> !retained.contains(url)).toList();
        mediaFiles.deleteManagedAfterCommit(removed);
        postMedia.deleteByPostId(post.getId());
        saveMedia(memberId, post, requests == null ? List.of() : requests, existingUrls);
    }

    private List<String> mediaUrls(List<PostMedia> values) {
        List<String> urls = new ArrayList<>();
        for (PostMedia item : values) {
            urls.add(item.getUrl());
            if (item.getThumbnailUrl() != null) urls.add(item.getThumbnailUrl());
        }
        return urls;
    }

    private PostResponse response(Post post, Long viewerId) {
        Member member = post.getMember();
        boolean visible = member.getAssetVisibility() != AssetVisibility.HIDDEN;
        BigDecimal value = visible ? post.getAuthorAssetValueKrw() : null;
        boolean liked = viewerId != null && likes.existsById(new PostLikeId(post.getId(), viewerId));
        boolean reposted = viewerId != null && reposts.existsById(new PostMemberId(post.getId(), viewerId));
        boolean bookmarked = viewerId != null && bookmarks.existsById(new PostMemberId(post.getId(), viewerId));
        List<MediaResponse> mediaResponses = postMedia.findByPostIdOrderByDisplayOrder(post.getId()).stream()
            .map(item -> new MediaResponse(item.getId(), item.getMediaType().name(), item.getUrl(),
                item.getThumbnailUrl(), item.getDisplayOrder())).toList();
        TradingViewResponse tradingView = post.getTradingViewSymbol() == null ? null
            : new TradingViewResponse(post.getTradingViewSymbol(), post.getTradingViewInterval(), post.getTradingViewAnalysis());
        PriceSnapshotResponse priceSnapshot = post.getAssetPrice() == null ? null
            : new PriceSnapshotResponse(post.getAssetPrice(), post.getAssetPriceCurrency(), post.getAssetPriceAt(), post.getAssetPriceSource());
        YoutubeResponse youtube = post.getYoutubeVideoId() == null ? null
            : new YoutubeResponse(post.getYoutubeUrl(), post.getYoutubeVideoId(), post.getYoutubeThumbnailUrl());
        HolderSnapshotResponse holderSnapshot = holderSnapshots.findById(post.getId()).map(item ->
            new HolderSnapshotResponse(item.getVerificationAvailability(), item.getVerificationLevel(),
                item.isVerifiedHolder(), item.getQuantityBand(), item.getHoldingMonths(), item.getWalletCount(),
                item.getCapturedAt(), item.getBlockNumber(), item.getSyncStatus(), item.getHolderStatus())).orElse(null);
        return new PostResponse(post.getId(), post.getCoin().getSymbol(), post.getTitle(), post.getContent(), author(member),
            visible && post.isAuthorVerified(), value, assetDisplay(member.getAssetVisibility(), value),
            likes.countByPostId(post.getId()), comments.countByPostId(post.getId()), liked,
            post.getCreatedAt(), post.getUpdatedAt(), mediaResponses, tradingView, priceSnapshot, youtube,
            reposts.countByPostId(post.getId()), reposted, bookmarked, holderSnapshot);
    }

    private AuthorResponse author(Member member) {
        return new AuthorResponse(member.getId(), member.getNickname(), member.getAvatarColor());
    }

    private String assetDisplay(AssetVisibility visibility, BigDecimal value) {
        if (visibility == AssetVisibility.HIDDEN || value == null) return "자산 비공개";
        if (visibility == AssetVisibility.RANGE) {
            long amount = value.longValue();
            if (amount < 10_000_000) return "1천만원 미만";
            if (amount < 100_000_000) return "1천만~1억원";
            if (amount < 1_000_000_000) return "1억~10억원";
            return "10억원 이상";
        }
        return "₩" + NumberFormat.getIntegerInstance(Locale.KOREA).format(value);
    }

    private int bounded(int size) { return Math.min(Math.max(size, 1), 100); }
    private String clean(String value) { return value == null || value.isBlank() ? null : value.trim(); }

    private void validateMediaUrl(String value) {
        if (value.startsWith("/api/v1/media/")) return;
        try {
            URI uri = URI.create(value);
            if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null)
                throw new IllegalArgumentException();
        } catch (IllegalArgumentException exception) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "미디어 URL은 업로드 URL 또는 HTTPS URL이어야 합니다.");
        }
    }

    private YoutubeData youtube(String value) {
        if (value == null || value.isBlank()) return null;
        Matcher matcher = YOUTUBE.matcher(value.trim());
        if (!matcher.matches()) throw new ApiException(HttpStatus.BAD_REQUEST, "올바른 YouTube 또는 Shorts URL이 아닙니다.");
        String videoId = matcher.group(1);
        return new YoutubeData(value.trim(), videoId, "https://i.ytimg.com/vi/" + videoId + "/hqdefault.jpg");
    }

    private enum FeedType {
        POST(0), REPOST(1);
        private final int rank;
        FeedType(int rank) { this.rank = rank; }
    }
    private record FeedEvent(FeedType type, Instant occurredAt, Member actor, Post post) {}
    private record FeedCursor(Instant occurredAt, FeedType type, long postId, long actorId) {}
    private record YoutubeData(String url, String videoId, String thumbnailUrl) {}
}
