package com.cryptalk.media;

import java.util.List;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MediaAssetRepository extends JpaRepository<MediaAsset, String> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select asset from MediaAsset asset where asset.fileName = :fileName")
    Optional<MediaAsset> lockByFileName(@Param("fileName") String fileName);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    List<MediaAsset> findByDraftIdOrderByFileName(Long draftId);

}
