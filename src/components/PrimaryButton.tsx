type PrimaryButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
};

export default function PrimaryButton({ children, onClick }: PrimaryButtonProps) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "10px 14px",
        borderRadius: 10,
        border: "1px solid rgba(0,0,0,0.12)",
        background: "white",
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}
