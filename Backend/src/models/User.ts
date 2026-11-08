import mongoose, { Model, Schema } from 'mongoose';

export type UserRole = 'admin' | 'manager' | 'citizen';
export type AccountStatus = 'active' | 'suspended' | 'pending';

export interface IUser {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  accountStatus: AccountStatus;
  profileImageUrl?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'User name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        'Please provide a valid email address'
      ]
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: false // Excluded from default queries for security
    },
    role: {
      type: String,
      required: [true, 'User role is required'],
      enum: {
        values: ['admin', 'manager', 'citizen'],
        message: '{VALUE} is not a valid AERON role. Must be admin, manager, or citizen'
      },
      default: 'citizen'
    },
    accountStatus: {
      type: String,
      enum: {
        values: ['active', 'suspended', 'pending'],
        message: '{VALUE} is not a valid account status'
      },
      default: 'active'
    },
    profileImageUrl: {
      type: String,
      trim: true
    }
  },
  {
    collection: 'users',
    timestamps: true
  }
);

// Indexes
UserSchema.index({ role: 1 });
UserSchema.index({ accountStatus: 1 });

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
