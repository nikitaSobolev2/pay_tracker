declare module "react-swipeable-list" {
  import type {
    CSSProperties,
    FunctionComponent,
    PureComponent,
    ReactNode,
  } from "react";

  export enum Type {
    ANDROID = 0,
    IOS = 1,
    MS = 2,
  }

  export const SwipeAction: FunctionComponent<{
    children: ReactNode;
    destructive?: boolean;
    onClick: () => void;
    Tag?: string;
  }>;

  export const LeadingActions: FunctionComponent<{ children: ReactNode }>;
  export const TrailingActions: FunctionComponent<{ children: ReactNode }>;

  export const SwipeableList: FunctionComponent<{
    children: ReactNode;
    fullSwipe?: boolean;
    destructiveCallbackDelay?: number;
    style?: CSSProperties;
    className?: string;
    type?: Type;
    Tag?: string;
    scrollStartThreshold?: number;
    swipeStartThreshold?: number;
    threshold?: number;
    optOutMouseEvents?: boolean;
  }>;

  export class SwipeableListItem extends PureComponent<{
    actionDelay?: number;
    blockSwipe?: boolean;
    children?: ReactNode;
    destructiveCallbackDelay?: number;
    fullSwipe?: boolean;
    leadingActions?: ReactNode;
    listType?: Type;
    maxSwipe?: number;
    onClick?: () => void;
    onSwipeEnd?: (dragDirection: string) => void;
    onSwipeProgress?: (progress: number, dragDirection: string) => void;
    onSwipeStart?: (dragDirection: string) => void;
    scrollStartThreshold?: number;
    swipeStartThreshold?: number;
    threshold?: number;
    trailingActions?: ReactNode;
    className?: string;
    optOutMouseEvents?: boolean;
    /** Injected by SwipeableList */
    id?: string;
    clickedCallback?: (id: string) => void;
    resetState?: (close: () => void) => void;
  }> {}
}

declare module "react-swipeable-list/dist/styles.css";
