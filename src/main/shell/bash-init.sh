# Bash Organizer — integração com o shell (copiado para %APPDATA% a cada início).
# Reproduz o startup de um login shell do Git Bash e emite sequências que o app entende:
#   OSC 6973;cwd;<C:/caminho>         diretório atual em formato Windows (a cada prompt)
#   OSC 6973;start;<comando>          um comando começou a executar
#   OSC 6973;end;<código de saída>    o comando terminou
# O caminho vem de `pwd -W` (embutido no bash do Git, sem subprocesso): respeita os pontos de
# montagem do MSYS (ex.: /tmp → %TEMP%), que uma conversão ingênua de /c/... erraria.

[ -f /etc/profile ] && . /etc/profile
if [ -f ~/.bash_profile ]; then . ~/.bash_profile
elif [ -f ~/.bash_login ]; then . ~/.bash_login
elif [ -f ~/.profile ]; then . ~/.profile
elif [ -f ~/.bashrc ]; then . ~/.bashrc
fi

# CLI `bo` do app disponível em todo terminal aberto por ele.
[ -n "$BO_BIN" ] && PATH="$BO_BIN:$PATH"

# __bo_state: 0 = executando comando, 1 = pronto para o próximo, 2 = rodando o PROMPT_COMMAND
__bo_state=2

__bo_precmd() {
  local ec=$?
  [ "$__bo_state" = 0 ] && printf '\033]6973;end;%s\007' "$ec"
  __bo_state=2
  printf '\033]6973;cwd;'; builtin pwd -W; printf '\007' # a quebra de linha do pwd é descartada pelo app
}

__bo_arm() { __bo_state=1; }

__bo_preexec() {
  [ "$__bo_state" = 1 ] || return
  [ -n "$COMP_LINE" ] && return
  case "$BASH_COMMAND" in __bo_*) return ;; esac # Enter vazio cai direto no PROMPT_COMMAND
  __bo_state=0
  printf '\033]6973;start;%s\007' "$BASH_COMMAND"
}

case ";${PROMPT_COMMAND};" in
  *";__bo_precmd;"*) ;;
  *) PROMPT_COMMAND="__bo_precmd${PROMPT_COMMAND:+;$PROMPT_COMMAND};__bo_arm" ;;
esac

# Não sobrescreve um trap DEBUG que o usuário já tenha (ex.: bash-preexec).
[ -z "$(trap -p DEBUG)" ] && trap '__bo_preexec' DEBUG
