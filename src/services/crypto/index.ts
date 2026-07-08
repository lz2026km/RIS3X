import { generateSM2KeyPair, sm2Sign, sm2Verify, sm2Encrypt, sm2Decrypt } from './sm2'
export { generateSM2KeyPair, sm2Sign, sm2Verify, sm2Encrypt, sm2Decrypt }
export type { SM2KeyPair, SM2Signature } from './sm2'
import { sm3Hash, sm3Hmac, sm3Verify } from './sm3'
export { sm3Hash, sm3Hmac, sm3Verify }
import { generateSM4Key, sm4Encrypt, sm4Decrypt, sm4GcmEncrypt, sm4GcmDecrypt } from './sm4'
export { generateSM4Key, sm4Encrypt, sm4Decrypt, sm4GcmEncrypt, sm4GcmDecrypt }
export type { SM4Key, SM4Mode } from './sm4'
import { generateSelfSignedCert, validateCertChain, isDomesticCA } from './certificate'
export { generateSelfSignedCert, validateCertChain, isDomesticCA }
export type { SM2Certificate, SM2CertificateExtension } from './certificate'

export type NationalCryptoAlgorithm = 'sm2' | 'sm3' | 'sm4'

export function getSupportedAlgorithms(): NationalCryptoAlgorithm[] {
  return ['sm2', 'sm3', 'sm4']
}

export function hybridEncrypt(plaintext: string, recipientPublicKey: string): { encryptedKey: string; ciphertext: string } {
  const sessionKey = generateSM4Key('gcm')
  const encryptedKey = sm2Encrypt(sessionKey.key, recipientPublicKey)
  const { ciphertext } = sm4GcmEncrypt(plaintext, sessionKey)
  return { encryptedKey, ciphertext }
}

export function hybridDecrypt(encryptedKey: string, ciphertext: string, recipientPrivateKey: string): string {
  const sessionKeyStr = sm2Decrypt(encryptedKey, recipientPrivateKey)
  return atob(ciphertext)
}
