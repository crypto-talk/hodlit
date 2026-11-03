package com.cryptalk.common;

import java.time.Instant;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(ApiException.class)
    ResponseEntity<Map<String, Object>> handleApi(ApiException exception) {
        var body = new java.util.HashMap<>(error(exception.getMessage()));
        if (exception.code() != null) body.put("code", exception.code());
        return ResponseEntity.status(exception.status()).body(body);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException exception) {
        FieldError fieldError = exception.getBindingResult().getFieldErrors().stream().findFirst().orElse(null);
        String message = fieldError == null ? "요청값을 확인해 주세요." : fieldError.getField() + ": " + fieldError.getDefaultMessage();
        return ResponseEntity.badRequest().body(error(message));
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    ResponseEntity<Map<String, Object>> handleTypeMismatch(MethodArgumentTypeMismatchException exception) {
        Class<?> type = exception.getRequiredType();
        String guidance = type == int.class || type == Integer.class
            ? "정수로 입력해 주세요." : "요청값 형식을 확인해 주세요.";
        return ResponseEntity.badRequest().body(error(exception.getName() + ": " + guidance));
    }

    @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
    ResponseEntity<Map<String, Object>> handleConflict(org.springframework.dao.DataIntegrityViolationException exception) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(error("중복되거나 다른 데이터에서 참조 중인 항목입니다."));
    }

    private Map<String, Object> error(String message) {
        return Map.of("message", message, "timestamp", Instant.now().toString());
    }
}
