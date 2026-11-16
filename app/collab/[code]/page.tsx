import CollabClient from "./CollabClient"
export const metadata={referrer:"no-referrer" as const}
interface Props {params:Promise<{code:string}>;searchParams:Promise<{invite?:string}>}
export default async function CollabPage({params,searchParams}:Props){
 const {code}=await params
 const {invite}=await searchParams
 return <CollabClient code={code.toUpperCase()} invite={typeof invite==="string"?invite:""}/>
}
