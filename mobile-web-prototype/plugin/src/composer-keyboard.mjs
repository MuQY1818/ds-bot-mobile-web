/** Observe real local Session submissions, without duplicating the host's send/keymap rules. */
export function createComposerKeyboard({anchor,enabled,document}){
  let initialized=false
  const seen=new Set()
  return {
    update(submissions=[]){
      let started=false
      const current=new Set()
      for(const submission of submissions){
        if(typeof submission?.requestId!=='string')continue
        current.add(submission.requestId)
        if(seen.has(submission.requestId))continue
        if(initialized)started=true
        seen.add(submission.requestId)
      }
      initialized=true
      // Bound bookkeeping for long-lived composers. Current pending ids stay
      // present, while old settled identities need no permanent UI history.
      for(const id of seen){if(seen.size<=256)break;if(!current.has(id))seen.delete(id)}
      if(!started||!enabled())return false
      const card=anchor()?.closest('[data-composer-card]')
      const input=card?.querySelector('[data-composer-input]')
      if(!input||document.activeElement!==input)return false
      input.blur()
      return true
    },
  }
}
