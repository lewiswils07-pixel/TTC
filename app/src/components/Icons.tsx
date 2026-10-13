import { ChevronLeft, ChevronRight, Ellipsis, Plus, SendHorizontal, X } from 'lucide-react'

/** One icon set for the whole app (testers, 13 Oct: text marks like ‹ › × looked unfinished). Decorative: the text beside each says what it does. */
const props = { 'aria-hidden': true, focusable: false, strokeWidth: 2.25 } as const

export const BackIcon = () => <ChevronLeft className="icon icon-back" size={20} {...props} />
export const NextIcon = () => <ChevronRight className="icon icon-next" size={20} {...props} />
export const CloseIcon = ({ size = 16 }: { size?: number }) => <X className="icon" size={size} {...props} />
export const MoreIcon = () => <Ellipsis className="icon" size={22} {...props} />
export const SendIcon = () => <SendHorizontal className="icon" size={20} {...props} />
export const AddIcon = () => <Plus className="icon" size={18} {...props} />
