from sqlmodel import SQLModel, Field, Relationship
from typing import List, Optional
from datetime import datetime

# Tabela principal do projeto, para centralizar as informações de usuários
class Usuario(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    nome: str
    senha: str

    comentarios: List["Comentario"] = Relationship(back_populates="usuario")
    eventos_agendados: list["AgendaEvento"] = Relationship(back_populates="usuario")

# Comentários para o blog dos eventos, com nota de 1 a 5 e texto 
class Comentario(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    usuario_id: int | None = Field(default=None, foreign_key="usuario.id")
    evento_id: str
    nota: int = Field(ge=1, le=5) 
    texto: str
    data_hora: datetime = Field(default_factory=datetime.now)

    usuario: "Usuario" = Relationship(back_populates="comentarios")

# Tabela de associação entre usuários e eventos agendados
class AgendaEvento(SQLModel, table=True):
    usuario_id: int = Field(foreign_key="usuario.id", primary_key=True)
    evento_id: str = Field(primary_key=True)

    usuario: "Usuario" = Relationship(back_populates="eventos_agendados")