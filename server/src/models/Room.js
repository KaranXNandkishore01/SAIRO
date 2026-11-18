import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema(
  {
    publicId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    roomHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    authVerifier: {
      type: String,
      required: true,
      trim: true,
    },
    salt: {
      type: String,
      required: true,
      trim: true,
    },
    maxParticipants: {
      type: Number,
      default: 10,
      min: 2,
      max: 25,
    },
    burnWhenEmpty: {
      type: Boolean,
      default: false,
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

// MongoDB TTL index: automatically purges expired rooms
roomSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Room = mongoose.model('Room', roomSchema);

export default Room;
