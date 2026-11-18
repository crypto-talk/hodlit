package com.cryptalk.auth;

import com.cryptalk.wallet.WalletChain;
import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import org.bouncycastle.math.ec.rfc8032.Ed25519;
import org.springframework.stereotype.Component;
import org.web3j.crypto.Keys;
import org.web3j.crypto.Sign;
import org.web3j.utils.Numeric;

@Component
public class WalletSignatureVerifier {
    private static final String BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    private static final BigInteger BASE58_RADIX = BigInteger.valueOf(58);

    public boolean isSolanaAddress(String address) {
        return decodeBase58(address, Ed25519.PUBLIC_KEY_SIZE) != null;
    }

    public boolean verify(WalletChain chain, String address, String message, String signature) {
        return switch (chain) {
            case EVM -> verify(address, message, signature);
            case SOLANA -> verifySolana(address, message, signature);
        };
    }

    public boolean verify(String address, String message, String signature) {
        try {
            byte[] bytes = Numeric.hexStringToByteArray(signature);
            if (bytes.length != 65) return false;
            byte v = bytes[64];
            if (v < 27) v += 27;
            Sign.SignatureData data = new Sign.SignatureData(v, Arrays.copyOfRange(bytes, 0, 32), Arrays.copyOfRange(bytes, 32, 64));
            BigInteger key = Sign.signedPrefixedMessageToKey(message.getBytes(StandardCharsets.UTF_8), data);
            return ("0x" + Keys.getAddress(key)).equalsIgnoreCase(address);
        } catch (Exception ignored) {
            return false;
        }
    }

    private boolean verifySolana(String address, String message, String signature) {
        byte[] publicKey = decodeBase58(address, Ed25519.PUBLIC_KEY_SIZE);
        byte[] signatureBytes = decodeBase58(signature, Ed25519.SIGNATURE_SIZE);
        if (publicKey == null || signatureBytes == null) return false;

        Ed25519.PublicPoint point = Ed25519.validatePublicKeyFullExport(publicKey, 0);
        byte[] messageBytes = message.getBytes(StandardCharsets.UTF_8);
        return point != null && Ed25519.verify(signatureBytes, 0, point, messageBytes, 0, messageBytes.length);
    }

    private static byte[] decodeBase58(String encoded, int size) {
        if (encoded.length() < size || encoded.length() > (size * 138 / 100 + 1)) return null;
        int leadingZeros = 0;
        while (leadingZeros < encoded.length() && encoded.charAt(leadingZeros) == '1') leadingZeros++;

        BigInteger value = BigInteger.ZERO;
        for (int index = leadingZeros; index < encoded.length(); index++) {
            int digit = BASE58_ALPHABET.indexOf(encoded.charAt(index));
            if (digit < 0) return null;
            value = value.multiply(BASE58_RADIX).add(BigInteger.valueOf(digit));
        }

        byte[] magnitude = value.toByteArray();
        int offset = magnitude[0] == 0 ? 1 : 0;
        int length = magnitude.length - offset;
        if (leadingZeros + length != size) return null;
        byte[] decoded = new byte[size];
        System.arraycopy(magnitude, offset, decoded, leadingZeros, length);
        return decoded;
    }
}
