import { Loading } from "@/components/Loading"
import { BlockContext, blockInfoState$ } from "@/state/block.state"
import { useStateObservable } from "@react-rxjs/core"
import { useParams } from "react-router-dom"
import { BlockBody } from "./BlockBody"
import { BlockInfoView } from "./BlockInfo"

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
