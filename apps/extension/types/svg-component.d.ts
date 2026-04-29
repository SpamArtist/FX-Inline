declare module "*.svg?component" {
  import type { ComponentType, JSX } from "preact";

  export type SvgComponentProps = JSX.SVGAttributes<SVGSVGElement> & {
    title?: string;
    titleId?: string;
    desc?: string;
    descId?: string;
  };

  const SvgComponent: ComponentType<SvgComponentProps>;

  export default SvgComponent;
}
