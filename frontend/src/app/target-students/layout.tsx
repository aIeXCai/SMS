import type { ReactNode } from "react";
import "./target-students.css";

type TargetStudentsLayoutProps = {
  children: ReactNode;
};

export default function TargetStudentsLayout({ children }: TargetStudentsLayoutProps) {
  return <>{children}</>;
}
