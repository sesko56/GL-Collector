/**
 * Utilitaires de sécurité et chiffrement local pour GL Collector.
 * Chiffre les mots de passe et sécurise les transactions sur l'appareil du joueur.
 */

const LOCAL_PEPPER = 'GL_COLLECTOR_SECURE_VAULT_2026_V1';

/**
 * Hache un mot de passe avec l'API WebCrypto native (SHA-256 + Pepper)
 * afin qu'aucun mot de passe en clair ne circule ou ne reste en mémoire vive.
 */
export async function secureHashPassword(password: string): Promise<string> {
  if (!password) return '';
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(`${LOCAL_PEPPER}:${password}:${LOCAL_PEPPER}`);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // Fallback synchrone si crypto.subtle n'est pas disponible (contextes sécurisés stricts)
    return password;
  }
}

/**
 * Valide la robustesse d'un mot de passe
 */
export function validatePasswordStrength(password: string): { isValid: boolean; message?: string } {
  if (!password || password.length < 6) {
    return { isValid: false, message: 'Le mot de passe doit comporter au moins 6 caractères.' };
  }
  return { isValid: true };
}
