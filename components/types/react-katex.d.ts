declare module "react-katex" {
  import * as React from "react"
  interface MathProps {
    math: string
    errorColor?: string
    renderError?: (error: Error) => React.ReactNode
  }
  export const InlineMath: React.FC<MathProps>
  export const BlockMath: React.FC<MathProps>
}
