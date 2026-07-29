import WhiteboardMathStudio from "@/components/whiteboard/WhiteboardMathStudio"
import styles from "./display.module.css"

export default function PizarraInteractivaPage() {
  return (
    <div className={styles.page}>
      <WhiteboardMathStudio />
    </div>
  )
}
