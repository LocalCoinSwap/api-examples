import { decrypt } from 'eciesjs'

export const decryptMessageWithAccountKey = (encryptedMessage, accountKey) => {
  // Preperation of private key from accountKey
  const privateKey = Buffer.from(accountKey, 'hex')
  const encryptedMessageBytes = Buffer.from(encryptedMessage, 'hex')
  const decryptedMessage = decrypt(privateKey, encryptedMessageBytes)
  return decryptedMessage.toString('utf8')
}
