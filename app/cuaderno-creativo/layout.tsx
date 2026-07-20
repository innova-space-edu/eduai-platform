import type { ReactNode } from "react";
import styles from "./watercolor.module.css";

type CuadernoCreativoLayoutProps = {
  children: ReactNode;
};

export default function CuadernoCreativoLayout({
  children,
}: CuadernoCreativoLayoutProps) {
  return <div className={styles.watercolorNotebook}>{children}</div>;
}
