package com.cryptalk.admin;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.cryptalk.common.ApiException;
import com.cryptalk.member.MemberRepository;
import org.junit.jupiter.api.Test;

class AdminAccessTest {
    @Test
    void emptyAllowlistDeniesEveryoneWithoutCheckingMembership() {
        var members = mock(MemberRepository.class);
        var access = new AdminAccess("", members);
        assertThrows(ApiException.class, () -> access.requireAdmin(1L));
        assertThrows(ApiException.class, () -> access.requireAdmin(null));
        verifyNoInteractions(members);
    }

    @Test
    void requiresBothExplicitApprovalAndExistingMember() {
        var members = mock(MemberRepository.class);
        when(members.existsById(7L)).thenReturn(true);
        var access = new AdminAccess("7, 8", members);
        assertDoesNotThrow(() -> access.requireAdmin(7L));
        assertThrows(ApiException.class, () -> access.requireAdmin(8L));
        assertThrows(ApiException.class, () -> access.requireAdmin(9L));
        assertThrows(IllegalArgumentException.class, () -> new AdminAccess("0",members));
    }
}
