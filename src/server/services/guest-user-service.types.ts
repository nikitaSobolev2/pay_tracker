export type GuestUserDto = {
  readonly id: string;
  readonly name: string;
};

export type EnsureGuestUserInput = {
  readonly guestUserId: string | null;
  readonly name?: string;
  readonly locale: string;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
};

export type RenameGuestUserInput = {
  readonly guestUserId: string;
  readonly name: string;
};

export type EventViewerDto = {
  readonly id: string;
  readonly name: string;
  readonly isOwner: boolean;
};
