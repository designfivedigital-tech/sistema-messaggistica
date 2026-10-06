type CustomerAvatarProps = {
  displayName: string;
  avatarUrl: string | null;
};

export function CustomerAvatar({
  displayName,
  avatarUrl,
}: CustomerAvatarProps) {
  return (
    <div className="customers-avatar">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={`Avatar di ${displayName}`}
        />
      ) : (
        displayName
          .trim()
          .charAt(0)
          .toUpperCase() || "C"
      )}
    </div>
  );
}
