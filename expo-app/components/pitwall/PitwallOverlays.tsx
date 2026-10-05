import React, { useEffect, useRef } from 'react';
import { Button, Dialog, Sheet, Text, XStack, YStack } from 'tamagui';
import { X } from 'lucide-react-native';
import { Platform, useWindowDimensions } from 'react-native';
import { useFeedback } from '@/components/FeedbackProvider';
export type PitwallOverlayProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description?: string;
    children: React.ReactNode;
};
/** Accessible Tamagui dialog primitive with the Pitwall flat dark surface. */
export function PitwallDialog({ open, onOpenChange, title, description, children }: PitwallOverlayProps) {
    const { width } = useWindowDimensions();
    return (<Dialog open={open} onOpenChange={onOpenChange} modal>
         <Dialog.Portal>
            <Dialog.Overlay key="overlay" opacity={0.62} backgroundColor="#000000"/>
            <Dialog.Content bordered elevate={false} key="content" width={Math.min(420, width - 32)} maxWidth={420} maxHeight="88%" padding={22} borderRadius={4} borderColor="#454545" backgroundColor="#171717" gap={18}>
               <YStack gap={description ? 8 : 0}>
                  <Dialog.Title color="#e9e9e9" fontFamily="$body" fontSize={23} fontWeight="800" letterSpacing={-0.8}>
                     {title}
                  </Dialog.Title>
                  {description ? (<Dialog.Description color="#aaaaaa" fontFamily="$body" fontSize={13} lineHeight={19}>
                        {description}
                     </Dialog.Description>) : null}
               </YStack>
               {children}
            </Dialog.Content>
         </Dialog.Portal>
      </Dialog>);
}
/** Bottom sheet primitive that follows the same accessible surface treatment. */
export function PitwallSheet({ open, onOpenChange, title, description, children }: PitwallOverlayProps) {
    const { reducedMotion } = useFeedback();
    const frameRef = useRef<unknown>(null);
    const changeRef = useRef(onOpenChange);
    changeRef.current = onOpenChange;
    useEffect(() => {
        if (!open || Platform.OS !== 'web')
            return;
        const previous = document.activeElement as HTMLElement | null;
        const host = () => frameRef.current as HTMLElement | null;
        const focusables = () => Array.from(host()?.querySelectorAll<HTMLElement>('button, input, textarea, select, [tabindex="0"]') ?? []).filter(element => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true');
        const request = requestAnimationFrame(() => focusables()[0]?.focus());
        const key = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                changeRef.current(false);
                return;
            }
            if (event.key !== 'Tab')
                return;
            const elements = focusables();
            if (!elements.length)
                return;
            const first = elements[0], last = elements[elements.length - 1];
            if (event.shiftKey && (document.activeElement === first || !host()?.contains(document.activeElement))) {
                event.preventDefault();
                last.focus();
            }
            else if (!event.shiftKey && (document.activeElement === last || !host()?.contains(document.activeElement))) {
                event.preventDefault();
                first.focus();
            }
        };
        document.addEventListener('keydown', key);
        return () => { cancelAnimationFrame(request); document.removeEventListener('keydown', key); if (previous?.isConnected)
            previous.focus(); };
    }, [open]);
    if (!open)
        return null;
    return (<Sheet open={open} onOpenChange={onOpenChange} modal moveOnKeyboardChange dismissOnOverlayPress snapPoints={[88]} snapPointsMode="percent" zIndex={100000} transitionConfig={{ type: 'timing', duration: reducedMotion ? 0 : 220 }}>
         <Sheet.Overlay backgroundColor="#000000" opacity={0.62}/>
         <Sheet.Frame width="100%" maxWidth={720} alignSelf="center" paddingHorizontal={22} paddingTop={12} paddingBottom={28} borderTopLeftRadius={4} borderTopRightRadius={4} borderWidth={1} borderColor="#454545" backgroundColor="#171717" gap={18}>
            <YStack ref={frameRef as React.Ref<any>} role="dialog" aria-modal aria-label={title} flex={1} minHeight={0} gap={18}>
            <Sheet.Handle backgroundColor="#666666"/>
            <YStack gap={description ? 8 : 0}>
               <XStack alignItems="center" justifyContent="space-between">
               <Text color="#e9e9e9" fontFamily="$body" fontSize={23} fontWeight="800" letterSpacing={-0.8} role="heading">
                  {title}
               </Text>
               <Button width={44} height={44} padding={0} borderWidth={0} borderRadius={0} backgroundColor="transparent" aria-label={`Close ${title}`} onPress={() => onOpenChange(false)}><X color="#e9e9e9" size={20}/></Button>
               </XStack>
               {description ? (<Text color="#aaaaaa" fontFamily="$body" fontSize={13} lineHeight={19}>
                     {description}
                  </Text>) : null}
            </YStack>
            {children}
            </YStack>
         </Sheet.Frame>
      </Sheet>);
}

