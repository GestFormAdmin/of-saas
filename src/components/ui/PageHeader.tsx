import * as React from "react";

type Props = {
  title: string;
  description?: string;
  subtitle?: string;
  right?: React.ReactNode;
};

export function PageHeader({ title, description, subtitle, right }: Props) {
  const text = description ?? subtitle;

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        {text ? <p className="text-sm text-muted-foreground">{text}</p> : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

export default PageHeader;
