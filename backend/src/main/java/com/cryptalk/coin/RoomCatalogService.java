package com.cryptalk.coin;

import com.cryptalk.admin.AdminAccess;
import com.cryptalk.common.ApiException;
import jakarta.validation.constraints.*;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RoomCatalogService {
    private final CoinRepository coins;
    private final RoomCategoryRepository categories;
    private final AdminAccess admins;
    private final JdbcTemplate jdbc;
    public RoomCatalogService(CoinRepository coins, RoomCategoryRepository categories, AdminAccess admins, JdbcTemplate jdbc) {
        this.coins = coins;
        this.categories = categories;
        this.admins = admins;
        this.jdbc = jdbc;
    }

    @Transactional
    public RoomResponse create(Long actor, CreateRoom request) {
        admins.requireAdmin(actor);
        String symbol = request.symbol().toUpperCase(Locale.ROOT);
        if (coins.existsBySymbolIgnoreCase(symbol)) throw new ApiException(HttpStatus.CONFLICT, "이미 존재하는 심볼입니다. 삭제된 방도 같은 심볼로 재생성할 수 없습니다.");
        checkCategory(request.categoryId());
        Coin coin = coins.saveAndFlush(new Coin(symbol, request.name().strip(), request.displayOrder(), request.categoryId()));
        audit(actor, "rooms", coin.getId(), "NONE", "CREATED");
        return room(coin);
    }

    @Transactional
    public RoomResponse update(Long actor, String symbol, UpdateRoom request) {
        admins.requireAdmin(actor);
        Coin coin = coins.lockBySymbol(symbol).orElseThrow(this::notFound);
        checkCategory(request.categoryId());
        coin.updateCatalog(request.name().strip(), request.displayOrder(), request.categoryId(), request.active());
        audit(actor, "rooms", coin.getId(), "EXISTING", "UPDATED");
        return room(coin);
    }

    @Transactional
    public void delete(Long actor, String symbol) {
        admins.requireAdmin(actor);
        Coin coin = coins.lockBySymbol(symbol).orElseThrow(this::notFound);
        coin.updateCatalog(coin.getName(), coin.getDisplayOrder(), coin.getCategoryId(), false);
        audit(actor, "rooms", coin.getId(), "EXISTING", "INACTIVE");
    }

    @Transactional(readOnly = true)
    public List<CategoryResponse> categories() {
        return categories.findAllByOrderByDisplayOrderAscIdAsc().stream().map(this::category).toList();
    }

    @Transactional(readOnly = true)
    public List<CategoryResponse> adminCategories(Long actor) {
        admins.requireAdmin(actor);
        return categories();
    }

    @Transactional
    public CategoryResponse saveCategory(Long actor, Long id, CategoryRequest request) {
        admins.requireAdmin(actor);
        String name = request.name().strip();
        if (id == null ? categories.existsByNameIgnoreCase(name) : categories.existsByNameIgnoreCaseAndIdNot(name, id))
            throw new ApiException(HttpStatus.CONFLICT, "동일한 카테고리 이름이 있습니다.");
        RoomCategory result;
        if (id == null) result = categories.saveAndFlush(new RoomCategory(name, request.displayOrder()));
        else {
            result = categories.lockById(id).orElseThrow(this::notFound);
            result.update(name, request.displayOrder());
        }
        audit(actor, "categories", result.getId(), id == null ? "NONE" : "EXISTING", "SAVED");
        return category(result);
    }

    @Transactional
    public void deleteCategory(Long actor, Long id) {
        admins.requireAdmin(actor);
        var category = categories.lockById(id).orElseThrow(this::notFound);
        if (coins.existsByCategoryId(id)) throw new ApiException(HttpStatus.CONFLICT, "연결된 방을 다른 카테고리 또는 미분류로 이동한 뒤 삭제해 주세요.");
        categories.delete(category);
        audit(actor, "categories", id, "EXISTING", "DELETED");
    }
    private void checkCategory(Long id) {
        if (id != null) categories.lockById(id).orElseThrow(this::notFound);
    }
    private void audit(Long actor, String type, Long id, String before, String after) {
        jdbc.update("INSERT INTO moderation_logs(actor_id,target_type,target_id,before_state,after_state,reason,created_at) VALUES(?,?,?,?,?,?,?)",
            actor, type, id, before, after, "관리자 카탈로그 설정", Timestamp.from(Instant.now()));
    }
    private RoomResponse room(Coin c) { return new RoomResponse(c.getId(), c.getSymbol(), c.getName(), c.isActive(), c.getOperationStatus(), c.getDisplayOrder(), c.getCategoryId()); }
    private CategoryResponse category(RoomCategory c) { return new CategoryResponse(c.getId(), c.getName(), c.getDisplayOrder()); }
    private ApiException notFound() { return new ApiException(HttpStatus.NOT_FOUND, "방 또는 카테고리를 찾을 수 없습니다."); }
    public record CreateRoom(@NotBlank @Pattern(regexp = "[A-Za-z0-9]{2,20}") String symbol,
            @NotBlank @Size(max = 80) String name, @NotNull @Min(0) Integer displayOrder, @Positive Long categoryId) {}
    public record UpdateRoom(@NotBlank @Size(max = 80) String name, @NotNull @Min(0) Integer displayOrder,
            @Positive Long categoryId, @NotNull Boolean active) {}
    public record CategoryRequest(@NotBlank @Size(max = 80) String name, @NotNull @Min(0) Integer displayOrder) {}
    public record RoomResponse(Long id, String symbol, String name, boolean active, RoomOperationStatus operationStatus, int displayOrder, Long categoryId) {}
    public record CategoryResponse(Long id, String name, int displayOrder) {}
}
