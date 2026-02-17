export function AppCard({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        maxWidth: 960,
        margin: "0 auto",
        background: "#fff",
        border: "1px solid #e5e5e5",
        borderRadius: 12,
        padding: 24,
      }}
    >
      {title && <h1 style={{ margin: 0, fontSize: 22 }}>{title}</h1>}
      <div style={{ marginTop: title ? 12 : 0 }}>{children}</div>
    </div>
  );
}
