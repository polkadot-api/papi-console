import { Loading } from "@/components/Loading"
import { useStateObservable } from "@react-rxjs/core"
import { useParams } from "react-router-dom"
import { blockInfoState$ } from "../block.state"
import { BlockBody } from "./BlockBody"
import { BlockInfoView } from "./BlockInfo"
import { BlockContext } from "./blockContext"

export const BlockDetail = () => {
  const { hashOrHeight } = useParams()
  const block = useStateObservable(blockInfoState$(hashOrHeight ?? ""))

  if (!block) return <Loading>Loading block…</Loading>

  return (
    <div>
      <BlockContext value={block}>
        <BlockInfoView />
        <BlockBody />
      </BlockContext>
    </div>
  )
}
