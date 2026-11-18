package com.cryptalk.admin;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.cryptalk.common.ApiException;
import com.cryptalk.member.MemberRepository;
import com.cryptalk.member.MemberRole;
import org.junit.jupiter.api.Test;

class AdminAccessTest {
    @Test
    void missingPrincipalIsDeniedWithoutDatabaseAccess() {
        var members = mock(MemberRepository.class);
        var access = new AdminAccess(members);
        assertThrows(ApiException.class, () -> access.requireAdmin(null));
        verifyNoInteractions(members);
    }

    @Test
    void checksCurrentDatabaseRoleOnEveryCall() {
        var members = mock(MemberRepository.class);
        var access = new AdminAccess(members);
        when(members.existsByIdAndRole(7L, MemberRole.ADMIN)).thenReturn(false, true, false);
        assertThrows(ApiException.class, () -> access.requireAdmin(7L));
        assertDoesNotThrow(() -> access.requireAdmin(7L));
        assertThrows(ApiException.class, () -> access.requireAdmin(7L));
        assertThrows(ApiException.class, () -> access.requireAdmin(999L));
        verify(members, times(3)).existsByIdAndRole(7L, MemberRole.ADMIN);
    }
}
