export function RichText({ text }: { text: string }) {
  const parts = text.split(/(待完善)/g);
  return (
    <>
      {parts.map((part, index) =>
        part === "待完善" ? (
          <em key={index} className="todo">
            待完善
          </em>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}
