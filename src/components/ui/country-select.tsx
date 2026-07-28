import * as React from "react";
import { Select, type SelectProps } from "@/components/ui/select";
import { COUNTRIES } from "@/lib/countries";

export type CountrySelectProps = Omit<SelectProps, "children"> & {
  /** Placeholder option label shown when no country is selected. */
  placeholder?: string;
};

/**
 * ISO-3166 country picker. Renders every country as an `<option>` whose value is
 * the alpha-2 code, so the stored value drives reliable currency inference on
 * the backend. Fully compatible with react-hook-form: spread `{...register("country")}`.
 */
const CountrySelect = React.forwardRef<HTMLSelectElement, CountrySelectProps>(
  ({ placeholder = "Select country…", ...props }, ref) => {
    // Only default to the empty option when the caller isn't controlling the
    // value (react-hook-form / uncontrolled). Controlled callers pass `value`,
    // and mixing `value` with `defaultValue` warns in React.
    const isControlled = props.value !== undefined;
    return (
      <Select ref={ref} {...(isControlled ? {} : { defaultValue: "" })} {...props}>
        <option value="" disabled>
          {placeholder}
        </option>
        {COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </Select>
    );
  },
);
CountrySelect.displayName = "CountrySelect";

export { CountrySelect };
