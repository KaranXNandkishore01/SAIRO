import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    roomHash: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    iv: {
      type: String,
      required: true,
    },
    ciphertext: {
      type: String,
      required: true,
    },
    senderSessionId: {
      type: String,
      required: true,
      trim: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

messageSchema.index({ roomHash: 1, createdAt: 1 });
// MongoDB TTL index: automatically purges expired ciphertexts
messageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Message = mongoose.model('Message', messageSchema);

export default Message;
