import * as React from "react";

export function Card({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={["rounded-lg border bg-background", className].join(" ")} {...props} />;
}

export function CardHeader({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={["p-4 border-b", className].join(" ")} {...props} />;
}

export function CardContent({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={["p-4", className].join(" ")} {...props} />;
}

export const CardBody = CardContent;

export function CardFooter({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={["p-4 border-t", className].join(" ")} {...props} />;
}

export default Card;
